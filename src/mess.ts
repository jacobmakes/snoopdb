import * as fs from 'fs'
import * as path from 'path'
import { resolve } from 'path'
import * as stream from 'stream'
import { Table, schema, queryOptions } from '.'

//cars
const schema1: schema = [
    //id is auto
    ['model', 'string', 8],
    ['produced', 'int', 4], // or allow user to enter a max number and calc eg. 1_000_000 => 3 because 3 bye max over 1mil
    //  atoms:['int',6],
]

async function main() {
    const cars = new Table('samples/cars.db')
    await cars.createTable('cars', schema1, { ifExists: 'overwrite' })
    const id = await cars.push(['foffo', 435])
    console.log('id', id)

    const id2 = await cars.push(['vvvolo', 1234556])
    await cars.push(['foggy', 12334556])
    await cars.push(['👵🏽', 35])
    await cars.push(['b', 43])
    await cars.push(['triumpth', 380])
    console.log('id2', id2)
    for (let i = 0; i < 600000; i++) {
        let r = randomString()
        await cars.push([r, Math.floor(Math.random() * 1000000)])
    }
    console.timeEnd()
    console.time()
    const dat = await cars.getRow(22)
    console.log('dat', dat)

    console.timeLog()
}
//main()

async function read() {
    const cars = new Table('samples/cars.db') //6million
    //await  books.createTable('books', schema2, { overwrite: true })
    await cars.getTable()
    console.log(await cars.getRowCount())
    console.log('dat', await cars.getRow(8195))
}
//read()
async function q() {
    const cars = new Table('samples/cars.db') //6million
    //await  books.createTable('books', schema2, { overwrite: true })
    await cars.getTable()
    console.time('ff')
    const options: queryOptions = {
        limit: 7,
        startId: 42656,
        filter: row => row.model.includes('vv') && row.produced < 80000000,
    }
    const dat = await cars.select(options)
    console.log('dat', dat)

    console.timeEnd('ff')
    slow(options.filter, options.limit)
    //console.log('dat', dat)
}
//q()

function randomString() {
    return Math.random().toString(36).slice(2, 7)
}
//console.log('cars', cars)

const schema2: schema = [
    //id is auto
    ['title', 'string', 20],
    ['author', 'string', 12],
    ['released', 'int', 4], // or allow user to enter a max number and calc eg. 1_000_000 => 3 because 3 bye max over 1mil
    //  atoms:['int',6],
]

async function main2() {
    try {
        const books = new Table('samples/books4.db')
        await books.createTable('books', schema2, { ifExists: 'overwrite' })

        // await books.getTable()
        const stats = await books.pushMany([
            ['mole diary', 'anne', 1982],
            ['scouting for gi', 'baden', 1943],
        ])
        const data = await books.push(['harry potter', 'jk rowling', 1998])
        const stats2 = await books.pushMany([
            ['mole diary', 'anne', 1982],
            ['scouting for gi', 'baden', 1943],
            ['that diary', 'anne', 1943],
        ])
        console.log('data', data)
        console.log('stats', stats2)

        await books.push(['da vincis co', 'dan brown', 2004])
        // console.log('data', data)
        const dat = await books.getRow(1)
        // console.time('push')
        // for (let i = 0; i < 6000000; i++) {
        //     let r = randomString()
        //     await books.push([r, r, Math.floor(Math.random() * 1000000)])
        // }
        // console.timeEnd('push')
        console.time('pushMany')
        const arr = []
        for (let i = 0; i < 6; i++) {
            let r = randomString()
            arr.push([r, r, Math.floor(Math.random() * 1000000)])
        }
        books.pushMany(arr)
        console.timeEnd('pushMany')
        const all = await books.select()
        // console.log('dat', dat)
        // console.log('all', all)

        // const sel = await books.select({
        //     filter: row => row.author.includes('jk'),
        //     //columns: ['id', 'released'],
        //     map: ({ id, author, released }) => released + '',
        // })
        // console.log('sel', sel)
        await books.hashIndex('author')
        await books.hashIndex('released')
        console.log(books.indexList())
        await books.hashFind('author', 'anne')
        const bookDescriptions = await books.select({
            map: book =>
                `${book.title} written by ${book.author} was released ${
                    new Date().getFullYear() - book.released
                } years ago`,
        })
        console.log('booksDescription', bookDescriptions)

        //console.log(books)
    } catch (error) {
        console.log(error)
        throw error
    }
}
//main2()

function slow(filter:queryOptions["filter"], limit:number|undefined) {
    console.time('slow')
    const data = fs.readFileSync('./samples/cars.json','utf-8')
    const arr = JSON.parse(data)
    //const filtered = arr.filter(row => row.model.includes('vv') && row.produced < 80000)
    const results = []
    for (let i = 0; i < arr.length; i++) {
        const row = arr[i]
        if (filter && filter(row)) {
            results.push(row)
            if (limit && results.length > limit) break
        }
    }
    //console.log('arr', results)
    console.timeEnd('slow')
}
//slow()

const farmersSchema: schema = [
    ['name', 'string', 30],
    ['animal', 'string', 10],
    ['born', 'int', 2], // or allow user to enter a max number and calc eg. 1_000_000 => 3 because 3 bye max over 1mil
    //  atoms:['int',6],
]

const fnames = [
    'Emily',
    'Aaron',
    'Charles',
    'Rebecca',
    'Jacob',
    'Stephen',
    'Patrick',
    'Sean',
    'Erin',
    'Zachary',
    'Jamie',
    'Kelly',
    'Samantha',
]
const surnames = ['Rogers', 'Beckett', 'Juniper', 'Daily', 'Bruno']

const animals = ['sheep', 'cow', 'pig', 'chicken']

const rand = (arr: any[]) => {
    return arr[Math.floor(Math.random() * arr.length)]
}

function intB(min:number, max:number) {
    // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min)
}

async function createFarmers() {
    const farmers = new Table('samples/farmers.db')
    await farmers.createTable('farmers', farmersSchema, { ifExists: 'error' })
    for (let i = 0; i < 1_000_000; i++) {
        await farmers.push([
            rand(fnames) + ' ' + rand(fnames) + ' ' + rand(surnames),
            rand(animals),
            intB(1918, 2008),
        ])
    }
    const all = await farmers.select()
    console.log('all', all)
}
//createFarmers()

async function index() {
    const farmers = new Table('samples/farmers.db') //6million
    //await  books.createTable('books', schema2, { overwrite: true })
    await farmers.getTable()
    console.time('hash')
    const hash = await farmers.hashIndex('name')
    console.timeEnd('hash')
    //console.log('hash', hash)
    console.time('hashF')
    const hashF = await farmers.hashIndexFast('name')
    //console.log('hashF', hashF)

    console.timeEnd('hashF')
    console.time('lookup')
    console.log(farmers.indexList())
    const find = await farmers.hashFind('name', 'Patrick Erin Bruno')
    console.timeEnd('lookup')
    console.time('lookupF')
    console.log(farmers.indexList())
    const findF = await farmers.hashFindFast('name', 'Patrick Erin Bruno')
    console.timeEnd('lookupF')
    console.log('find.length', find.length)

    //console.log('find', find)

    console.time('select')
    await farmers.select()
    console.timeEnd('select')
    //console.log('dat', dat)
}
//index()

async function createFarmers2() {
    const farmers = new Table('samples/farmers2.db')
    await farmers.createTable('farmers', farmersSchema, { ifExists: 'error' })
    for (let i = 0; i < 1_00; i++) {
        await farmers.push([
            rand(fnames) + ' ' + rand(fnames) + ' ' + rand(surnames),
            rand(animals),
            intB(1918, 2008),
        ])
    }
    const all = await farmers.select()
    console.log('all', all)
}
//createFarmers2()

async function multi() {
    // craete table 1 file assign to farmers
    try {
        const farmersA = new Table('samples/farmers3.db')
        await farmersA.createTable('farmers', farmersSchema, { ifExists: 'read' })
        for (let i = 0; i < 1_000_00; i++) {
            await farmersA.push([
                rand(fnames) + ' ' + rand(fnames) + ' ' + rand(surnames),
                rand(animals),
                intB(1918, 2008),
            ])
        }

        //create a second table reading from the same file
        const farmersB = new Table('samples/farmers3.db')
        await farmersB.getTable()
        console.log(await farmersA.getRow(1))
        console.log(await farmersB.getRow(2))

        //runs sync
        const fun = new Promise((resolve, reject) => {})

        var items = [...Array(3).keys()]
        var fn = function makeTableObjects() {
            // sample async action
            return new Promise(resolve => {
                const farmers = new Table('samples/farmers3.db')
                resolve(farmers)
            })
        }
        // var fn2 = function insertRow(data) {
        //     // sample async action
        //     console.log('og', data)
        //     // return new Promise(resolve => {
        //     //     const farmers = new Table('samples/farmers3.db')
        //     //     resolve(farmers.path)
        //     // })
        // }
        // map over forEach since it returns

        var actions = items.map(fn) // run the function over all items

        // // we now have a promises array and we want to wait for it

        // // Promise.all(actions).then(
        // //     data => console.log(data) // [2, 4, 6, 8, 10]
        // // )
        // var res2 = await Promise.all([...Array(3).keys()].map(fn))
        //     .then(data => Promise.all(data.map(fn)))
        //     .then(function (data) {
        //         // the next `then` is executed after the promise has returned from the previous
        //         // `then` fulfilled, in this case it's an aggregate promise because of
        //         // the `.all`
        //         //console.log(data)
        //         return Promise.all(
        //             data.map(obj => {
        //                 console.log(obj.path)
        //                 return new Promise(resolve => {
        //                     setTimeout(() => {
        //                         console.log('k;k')
        //                         resolve('ll')
        //                     }, 555)
        //                     resolve('ll')
        //                 })
        //             })
        //         )
        //     })
        // console.log('res2', res2)

        // .then(function (data) {
        //     // just for good measure
        //     console.log(data)
        //     return Promise.all(data.map(fn))
        // })

        const digits = [...Array(300).keys()]

        const fObjects = digits.map((_, i) => new Table('samples/farmers3.db'))

        await Promise.all(
            fObjects.map(farmer => {
                return farmer.getTable()
            })
        )
        const res = await Promise.all(
            fObjects.map(farmer => {
                return farmer.getRow(intB(1, 10000))
            })
        )
        console.log('ended')
    } catch (error) {
        console.error(error)
    }
}

// multi()

//push: 509.66ms
//pushMany: 99.505ms
async function pushVsMany() {
    const SIZE = 1000
    const farmers = new Table('samples/long/path/f200')
    await farmers.createTable('farmers', farmersSchema, { ifExists: 'overwrite' })
    console.time('push')
    for (let i = 0; i < SIZE; i++) {
        await farmers.push([
            rand(fnames) + ' ' + rand(fnames) + ' ' + rand(surnames),
            rand(animals),
            intB(1918, 2008),
        ])
    }
    console.timeEnd('push')
    console.time('pushMany')
    await farmers.push(['Danny', 'sheep', 2009])
    const arr: (string | number)[][] = []
    for (let i = 0; i < SIZE; i++) {
        arr.push([
            rand(fnames) + ' ' + rand(fnames) + ' ' + rand(surnames),
            rand(animals),
            intB(1918, 2008),
        ])
    }
    await farmers.pushMany(arr)
    // console.timeEnd('pushMany')
    // console.log((await farmers.select())[0])
    // const hash = await farmers.hashIndex('name')

    // console.log('a', hash['Danny'])
    // let danny = await farmers.hashFind('name', 'Danny')
    // console.log('b', hash['Danny'], danny)
    // danny = await farmers.hashFind('name', 'Danny')
    // console.log('c', hash['Danny'], danny)
    async function animalCount(animal: string) {
        let res = await farmers.select({ limit: 100, filter: row => row.animal === animal })
        const all = res
        while (res.length > 0) {
            res = await farmers.select({
                limit: 100,
                startId: res[res.length - 1].id + 1,
                filter: row => row.animal === animal,
            })
            all.push(...res)
        }
        return all.length
    }
    let count = 0
    for (let animal of animals) {
        count += await animalCount(animal)
    }
    console.log(count)
}
pushVsMany()
