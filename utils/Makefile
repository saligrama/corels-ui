CC = gcc
CFLAGS = -Wall -g -O1
LDFLAGS = -lgmp

all: mine minority

mine: mine.c
	$(CC) $(CFLAGS) $^ -o $@ $(LDFLAGS)

minority: minority.c
	$(CC) $(CFLAGS) $^ -o $@ $(LDFLAGS)
