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

hashFind vs hashFindFast
hashFind creates an object with an array of ids it stores in memory eg:

```
interface HashIndex {
    [key: string]: number[]
}
```

each time it does a find it looks up every id individually using the getRow. This means this function is best used when the index groups data into small amounts, with each key ideally having less than 0.1% of the data.
this is about 10 times faster than reading the entire file

hashFindFast fast stores the entire file in memory but with a hash index. It's 100 times faster than above function and I would reccomend using it unless you're going to exceed your computers memory. Then it's probably better to use a real db.

If you use multikey/multiple indexes (not implemented) this may be faster in some cases

```
interface FastHashIndex {
    [key: string]: any
}
```

These indexes DO NOT change when the database is updated or written to so you must call hashIndex() or hashIndexFast() to reindex manually. Again the use case for this database is high reads and a smallor zero number of writes

rename transform to map
