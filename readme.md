# Snoopdb

A zero dependancy node.js library for when you need fast reads but a full database is too much and reading from a json file is too slow. This organizes text in file in a way that allows it to get the exact position of a row without having to read and parse the entire file. Meaning 1ms reads on [databases GBs in size](#performance).

## Use cases

-   A good learning tool and intro to SQL
-   in a serverless environment (cloud/lamda function) where you can read directly from a file stored there.

## Instalation

```sh
npm i snoopdb
```

## Quick start

```javascript
const booksSchema = [
    ['title', 'string', 40],
    ['author', 'string', 20],
    ['released', 'int', 2],
    ['sold', 'int', 4],
]
const books = new Table('samples/books4.db')
await books.createTable('books', schema2, { ifExists: 'overwrite' })
await books.push(['Harry Potter', 'JK rowling', 1982, 465436436])

await books.pushMany([
    ['mole diary', 'anne', 1982, 465436436],
    ['scouting for gi', 'baden', 1943, 345342654],
])
const { id, title, author, released, sold } = await books.getRow(10324324353)
const allBooks = await books.select()
const oldBooks = await books.select({ filter: row => row.released < 1950 })
const bookDescription = await books.select({
    map: book =>
        `${book.title} written by ${book.author} was released ${
            new Date().getFullYear() - book.released
        } years ago`,
})
```

## Guide

### Create the Schema

Snoop db is a simple table store

```javascript
const booksSchema = [
    ['title', 'string', 40],
    ['author', 'string', 20],
    ['released', 'int', 2],
    ['sold', 'int', 4],
]
```
