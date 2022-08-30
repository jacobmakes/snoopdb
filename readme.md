# Snoopdb

A zero dependency node.js library for when you need fast reads but a full database is too much and reading from a json file is too slow. This organizes text in file in a way that allows it to get the exact position of a row without having to read and parse the entire file.

## Use cases

-   A good learning tool and intro to SQL
-   Create multiple in memory hashmaps of a database
-   In a serverless environment (cloud/lamda function) where you can read directly from a file stored there.\*

\*Not Production ready

## Installation

```sh
npm i snoopdb
```

## Quick start

```js
const booksSchema = [
    ['title', 'string', 40],
    ['author', 'string', 20],
    ['released', 'int', 2],
    ['sold', 'int', 4],
]
const books = new Table('books.db')
await books.createTable('books', booksSchema, { ifExists: 'overwrite' })
await books.push(['Harry Potter', 'JK rowling', 1982, 465436436])

await books.pushMany([
    ['mole diary', 'anne', 1982, 465436436],
    ['scouting for gi', 'baden', 1943, 345342654],
])
const { id, title, author, released, sold } = await books.getRow(3)
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

Snoop db is a simple table store, think excel. But each column must be defined before and cannot be changed. The scheme is defined very simply in an array of column details which contain

```
['column name','column type',size]
```

**column name** is a string describing the column. **column type** is what will be stored in it, currently the only two types are `string` and `int` and **size** is how many bytes long the column will be.

For strings the length is approximately the number of characters, but some characters like 👵🏽 can take up more than one byte.

For ints the size must be between 1 and 6 inclusive where the max number is (256^size)/2. eg An int with a max size 2 must be from -32768 to 32767.

```js
const booksSchema = [
    ['title', 'string', 40],
    ['author', 'string', 20],
    ['released', 'int', 2],
    ['sold', 'int', 4],
]
```

### Create the table and push data

```js
const books = new Table('books.db')
await books.createTable('books', booksSchema, { ifExists: 'overwrite' })
await books.push(["Harry Potter and the Philosopher's Stone", 'JK rowling', 1997, 465436436])

await books.pushMany([
    ['The Secret Diary of Adrian Mole, Aged 13¾', 'Sue Townsend', 1982, 465436436],
    ['scouting for boys', 'Robert Baden-Powell', 1908, 345342654],
])
```

You push data into the table with an array that contains the data in the same order as your schema. In this example 'booksSchema' goes title, author, released, year and so the data pushed must go in this order.

### Retrieve and Query Data

```js
const { id, title, author, released, sold } = await books.getRow(3)
```

The getRow function takes the row id (starts at 1) and returns an object containing the row data. They keys are the column names defined in the schema.

You can get an array of multiple rows using the select function

```js
//get All table info
const allBooks = await books.select()

//get all books released before 1950
const oldBooks = await books.select({ filter: row => row.released < 1950 })

//transform the retrieved data
const bookDescription = await books.select({
    map: book =>
        `${book.title} written by ${book.author} was released ${
            new Date().getFullYear() - book.released
        } years ago`,
})
```

Using select with no parameters will return all data. You can pass in a config object to pass in functions to further refine your data. The two fields are **map** and **filter** which work a similar way to the javascript array methods but can be be used together. Filter works first then the map method is applied to a row object.

### Limit and Offset

```js
const newBooksPage1 = await books.select({
    filter: row => row.released > 1980,
    limit: 1,
})
const endRow = newBooksPage1[newBooksPage1.length - 1]
const newBooksPage2 = await books.select({
    filter: row => row.released > 1980,
    limit: 1,
    startId: endRow.id + 1,
})
```

You can limit the data you get back with the **limit** and **startId** parameters. You can use this to impllement pagaination by saving the id of the last row and using it to start your next query. It's done this way because startId allows you to skip reading the entire start of the file which you'd have to do with a traditional offset.

If you want to offset like traditional sql, where the number represents the filtered results rather than row ID; do a select with the limit being the last row you need, then slice that array.

So if you had 100 items per page and wanted to go to page 4

```js
const first500 = await items.select({
    filter: row => items.age > 20,
    limit: 500,
})
const page4 = first500.slice(400, 500)
```

## Advanced Features

### Indexes

Indexes allow for faster searching in the array than conventional methods. Currently the only type of index implemented is a hash map, this allows you to look up any item in the array in O(1) time as opposed to O(n).

```js
//Create the hash index
await books.hashIndexFast('author')

//Find the value in the hash
const harryPotterBooks = await books.hashFindFast('author', 'jk rowling')
// returns an array of result objects [{id:1,...}]
```

This index is not updated when new items are added to the database. Instead you must do so manually be calling hashIndexFast again.

```js
await books.push(['Harry Potter and the Chamber of Secrets', 'JK rowling', 1997, 465436436])

//must be called again to re-index the database
await books.hashIndexFast('author')
```

In addition to `hashIndexFast` and `HashFindFast` there are also the non fast versions, these read from disk and are about 100 times slower. However the fast hash works by loading the entire db into memory, so in cases where the database file is too large to allow that the slower methods are recommended.
