#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <sys/time.h>

#include <gmp.h>

#include "timer.h"

void usage(const char *name)
{
  printf("USAGE: %s [-s min_support] [-c max_cardinality] [-v] [-h] [-m] csv_file out_file label_file [minor_file]\n", name);
}

// Cycles through all possible permutations of the numbers 1 through n-1 of length r
int getnextperm(int n, int r, int *arr, int first)
{
  // Initialization case
  if(first) {
    for(int i = 0; i < r; i++)
      arr[i] = i;

    return 0;
  }

  for(int i = 1; i < (r + 1); i++) {
    if(arr[r - i] < (n - i)) {
      arr[r - i]++;
      for(int j = (r - i + 1); j < r; j++)
        arr[j] = arr[r - i] + (j - r + i);
      return 0;
    }
  }

  return -1;
}

// Simply print a generated rule to a file, the extensive use of fputc actually speeds it up by 2-3 times
void print_rule(FILE *fp, int *rule_ids, int card, char **rule_names, char *rule_str, int nsamples)
{
  fputc('{', fp);
  fputs(rule_names[rule_ids[0]], fp);
  for(int i = 1; i < card; i++) {
    fputc(',', fp);
    fputs(rule_names[rule_ids[i]], fp);
  }
  fputc('}', fp);
  fputc(' ', fp);

  int l = strlen(rule_str);

  for(int i = 0; i < (nsamples - l); i++) {
    fputc('0', fp);
    fputc(' ', fp);
  }

  for(int i = 0; i < (l - 1); i++) {
    fputc(rule_str[i], fp);
    fputc(' ', fp);
  }
  fputc(rule_str[l - 1], fp);

  fputc('\n', fp);
}

int main(int argc, char **argv)
{
  us_t start = getus();

  extern char *optarg;
  int max_card = 2;
  double min_support = 0.0;
  char ch;
  int ntotal_rules = 0;
  int verbose = 0;
  while((ch = getopt(argc, argv, "c:s:vh")) != -1) {
    switch(ch) {
    case 'c':
      max_card = atoi(optarg);
      if(max_card < 1) {
        printf("Max cardinality must be greater than 0\n");
        return 1;
      }
      break;
    case 's':
      min_support = atof(optarg);
      if(min_support > 0.5 || min_support < 0.0) {
        printf("Minimum support must be less than or equal to 0.5 and greater than or equal to 0\n");
        return 1;
      }
      break;
    case 'v':
      verbose = 1;
      break;
    case 'h':
      usage(argv[0]);
      return 0;
    default:
      usage(argv[0]);
      return 1;
    };
  }
 
  int ret = 0, nrules = 0, nfeatures = 0, nsamples_raw = 0, nsamples = 0;
  size_t n = 0;
  int *rule_ids = NULL;
  char **features = NULL, **rules = NULL, **rule_names = NULL;
  char *rule_str = NULL, *line = NULL;
  mpz_t *rules_vec = NULL;
  char *labels[2];
  labels[0] = NULL;
  labels[1] = NULL;

  FILE *csv_fp = NULL, *out_fp = NULL, *label_fp = NULL;

  if((argc - optind) < 3) {
    printf("You must provide a csv, an out, and a label file\n");
    usage(argv[0]);
    return 1;
  }

  csv_fp = fopen(argv[optind], "r");
  if(!csv_fp) {
    printf("Could not open csv file!\n");
    ret = 1;
    goto end;
  }

  out_fp = fopen(argv[optind + 1], "w");
  if(!out_fp) {
    printf("Could not open/create .out file!\n");
    ret = 1;
    goto end;
  }

  label_fp = fopen(argv[optind + 2], "w");
  if(!label_fp) {
    printf("Could not open/create .label file!\n");
    ret = 1;
    goto end;
  }

  nsamples_raw = 0;
  int c;
  
  // Get the upper bound on the number of features
  nfeatures = 1;
  while(1) {
    c = getc(csv_fp);
    if(c == '\n')
      break;
    else if(c == ',')
      nfeatures++;
  }

  features = malloc(sizeof(char*) * nfeatures);

  // Get the upper bound on the number of samples
  while(1) {
    c = getc(csv_fp);

    if(c == '\n')
      nsamples_raw++;
    else if(c == EOF) {
      nsamples_raw++;
      break;
    }
  }

  labels[0] = malloc(2 * nsamples_raw + 1);
  labels[1] = malloc(2 * nsamples_raw + 1);

  rewind(csv_fp);

  int firstline = 1;
  nfeatures = 0;
  nsamples = 0;
  while(getline(&line, &n, csv_fp) != -1) {
    if(firstline) {
      // Get the actual number of features

      char *tok = strtok(line, ",\n");
      while(tok != NULL) {
        if(tok[0] == '\n' || tok[0] == '\0')
          break;

        nfeatures++;
        features[nfeatures - 1] = strdup(tok);
        tok = strtok(NULL, ",\n");
      }

      if((nfeatures - 1) < max_card) {
        printf("Max cardinality must be smaller than or equal to the number of rules\n");
        ret = 1;
        goto end;
      }

      // two for each feature - normal and not
      nrules = 2 * (nfeatures - 1);
      rules = malloc(sizeof(char*) * nrules);

      // the rules array stores the character string of bits that is printed to the .out file
      for(int i = 0; i < nrules; i++)
        rules[i] = malloc(2 * nsamples_raw + 1);

      firstline = 0;
    }
    else {
      // Read a sample

      char *tok = strtok(line, ",\n");

      // counter for the number of features read for this sample
      int i = 0;

      while(tok != NULL) {
        // Once the last bit (the classification bit) is encountered, set the label and break
        if(i == (nrules / 2)) {
          int num = atoi(tok);

          labels[0][2 * nsamples] = !num + '0';
          labels[0][2 * nsamples + 1] = ' ';
          labels[1][2 * nsamples] = !!num + '0';
          labels[1][2 * nsamples + 1] = ' ';
          break;
        }

        int bit = atoi(tok);
        rules[i][2 * nsamples] = !!bit + '0';
        rules[i][2 * nsamples + 1] = ' ';
        rules[nrules / 2 + i][2 * nsamples] = !bit + '0';
        rules[nrules / 2 + i][2 * nsamples + 1] = ' ';
        i++;

        tok = strtok(NULL, ",\n");
      }

      if(i == (nrules / 2))
        nsamples++;
    }

    free(line);
    line = NULL;
    n = 0;
  }

  free(line);
  line = NULL;
  n = 0;

  fclose(csv_fp);
  csv_fp = NULL;

  for(int i = 0; i < nrules; i++)
    rules[i][2 * nsamples - 1] = '\0';

  labels[0][2 * nsamples - 1] = '\0';
  labels[1][2 * nsamples - 1] = '\0';

  rules_vec = malloc(sizeof(mpz_t) * nrules);
  rule_names = malloc(sizeof(char*) * nrules);

  int min_thresh = min_support * (double)nsamples;
  int max_thresh = (1.0 - min_support) * (double)nsamples;

  // Trimmed number of rules: all rules except those that don't pass the minumum threshold
  int nrules_mine = 0;

  // File rules_vec, the mpz_t version of the rules array
  for(int i = 0; i < nrules; i++) {
    mpz_init2(rules_vec[nrules_mine], nsamples);
    if(mpz_set_str(rules_vec[nrules_mine], rules[i], 2) == -1) {
      mpz_clear(rules_vec[nrules_mine]);
      printf("Could not convert rules to vectors\n");
      ret = 2;
      goto end;
    }

    int ones = mpz_popcount(rules_vec[nrules_mine]);

    // If the rule satisfies the threshold requirements, add it to the out file.
    // If it exceeds the maximum threshold, it is still kept for later rule mining
    // If it less than the minimum threshold, don't add it
    if(ones <= min_thresh) {
      mpz_clear(rules_vec[nrules_mine]);
      continue;
    }
    
    if(i < (nrules / 2))
      rule_names[nrules_mine] = strdup(features[i]);
    else {
      rule_names[nrules_mine] = malloc(strlen(features[i - (nrules / 2)]) + 5);
      strcpy(rule_names[nrules_mine], features[i - (nrules / 2)]);
      strcat(rule_names[nrules_mine], "-not");
    }
    
    if(ones < max_thresh) {
      fprintf(out_fp, "{%s} %s\n", rule_names[nrules_mine], rules[i]);
      ntotal_rules++;
      
      if(verbose)
        printf("%s generated with support %f\n", rule_names[nrules_mine], (double)ones / (double)nsamples);
    }

    nrules_mine++;
  }

  fprintf(label_fp, "{label=0} %s\n", labels[0]);
  fprintf(label_fp, "{label=1} %s\n", labels[1]);

  for(int i = 0; i < nrules; i++)
    free(rules[i]);
  free(rules);
  rules = NULL;

  mpz_t gen_rule;
  mpz_init2(gen_rule, nsamples);

  rule_str = malloc(nsamples + 2);

  rule_ids = malloc(sizeof(int) * max_card);

  // Generate higher-cardinality rules
  for(int card = 2; card <= max_card; card++) {
    // getnextperm works sort of like strtok
    int r = getnextperm(nrules_mine, card, rule_ids, 1);

    while(r != -1) {
      int valid = 1;
      
      mpz_set(gen_rule, rules_vec[rule_ids[0]]);
      int ones = mpz_popcount(gen_rule);

      // Generate the new rule by successive and operations, and check if it has a valid support
      if(ones > min_thresh) {
        for(int i = 1; i < card; i++) {
          mpz_and(gen_rule, rules_vec[rule_ids[i]], gen_rule);
          ones = mpz_popcount(gen_rule);
          if(ones <= min_thresh) {
            valid = 0;
            break;
          }
        }

        if(valid && ones >= max_thresh)
          valid = 0;
      }
      else
        valid = 0;

      if(valid) {
        mpz_get_str(rule_str, 2, gen_rule);
        print_rule(out_fp, rule_ids, card, rule_names, rule_str, nsamples);
        ntotal_rules++;

        if(verbose) {
          putchar('{');
          fputs(rule_names[rule_ids[0]], stdout);
          for(int i = 1; i < card; i++) {
            putchar(',');
            fputs(rule_names[rule_ids[i]], stdout);
          }
          printf("} generated with support %f\n", (double)ones / (double)nsamples);
        }
      }

      r = getnextperm(nrules_mine, card, rule_ids, 0);
    }
  }

  mpz_clear(gen_rule);

end:
  if(csv_fp)
    fclose(csv_fp);
  if(out_fp)
    fclose(out_fp);
  if(label_fp)
    fclose(label_fp);

  if(features) {
    for(int i = 0; i < nfeatures; i++) {
      if(features[i])
        free(features[i]);
    }

    free(features);
  }

  if(rules) {
    for(int i = 0; i < nrules; i++)
      if(rules[i])
        free(rules[i]);

    free(rules);
  }

  if(labels[0])
    free(labels[0]);

  if(labels[1])
    free(labels[1]);

  if(rules_vec) {
    for(int i = 0; i < nrules_mine; i++)
      mpz_clear(rules_vec[i]);
  
    free(rules_vec);
  }

  if(rule_str)
    free(rule_str);

  if(rule_ids)
    free(rule_ids);

  if(rule_names) {
    for(int i = 0; i < nrules_mine; i++)
      if(rule_names[i])
        free(rule_names[i]);
  
    free(rule_names);
  }

  printf("Generated %d rules\n", ntotal_rules);

  long double diff = (long double)(getus() - start) / (long double)1000000.0;
  printf("Mining done after %Lf seconds\n", diff);

  return ret;
}
