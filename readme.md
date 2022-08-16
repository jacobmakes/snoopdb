use case for this is easy to use way to use a file as a database. Can read a single record much faster than those that have to load entire data into memory before reading a single value

Performance
For 6 million rows with very small columns (lenfth 12)
to load into memory and parse JSON takes aprox 600ms.
this can read in ~1ms
to get directly from an array in memory eg array[i] takes 0.01ms

Limted queries
this can read from the start of the file and stop when needed allowing much faster queries or it can start from a certain id offset for faster queries

implementing a column indexing feature would also be useful albiet probably end up being not much faster except occasionly

TODO:
count function and possibly unique function
