import * as fs from 'fs'
import * as path from 'path'
import * as stream from 'stream'
import { Table, schema } from '.'

//cars
const schema1: schema = [
    //id is auto
    ['model', 'string', 8],
    ['produced', 'int', 4], // or allow user to enter a max number and calc eg. 1_000_000 => 3 because 3 bye max over 1mil
    //  atoms:['int',6],
]

async function main() {
    const cars = new Table('samples/cars.db')
    cars.createTable('cars', schema1, { overwrite: false })
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
    const dat = await cars.read(22)
    console.log('dat', dat)

    console.timeLog()
}
//main()

async function read() {
    const cars = new Table('samples/cars.db') //6million
    // books.createTable('books', schema2, { overwrite: true })
    await cars.getTable()
    console.log(await cars.getRowCount())
    console.log('dat', await cars.read(8195))
}
//read()
async function q() {
    const cars = new Table('samples/cars.db') //6million
    // books.createTable('books', schema2, { overwrite: true })
    await cars.getTable()
    console.time('ff')
    const options: queryOptions = {
        limit: 7,
        offset: 42656,
        where: row => row.model.includes('vv') && row.produced < 80000000,
    }
    const dat = await cars.select(options)
    console.log('dat', dat)

    console.timeEnd('ff')
    slow(options.where, options.limit)
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
        const books = new Table('samples/books.db')
        books.createTable('books', schema2, { overwrite: true })
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
        const dat = await books.read(1)
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
        //     where: row => row.author.includes('jk'),
        //     //columns: ['id', 'released'],
        //     transform: ({ id, author, released }) => released + '',
        // })
        // console.log('sel', sel)
        await books.hashIndex('author')
        await books.hashIndex('released')
        console.log(books.indexList())
        await books.hashFind('author', 'anne')

        //console.log(books)
    } catch (error) {
        console.log(error)
        throw error
    }
}
//main2()

function slow(where, limit) {
    console.time('slow')
    const data = fs.readFileSync('./samples/cars.json')
    const arr = JSON.parse(data)
    //const filtered = arr.filter(row => row.model.includes('vv') && row.produced < 80000)
    const results = []
    for (let i = 0; i < arr.length; i++) {
        const row = arr[i]
        if (where && where(row)) {
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

function intB(min, max) {
    // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min)
}

async function createFarmers() {
    const farmers = new Table('samples/farmers.db')
    farmers.createTable('farmers', farmersSchema, { overwrite: true })
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
    // books.createTable('books', schema2, { overwrite: true })
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
    const findF = await farmers.hashFind('name', 'Patrick Erin Bruno')
    console.timeEnd('lookup')
    console.time('lookupF')
    console.log(farmers.indexList())
    const find = await farmers.hashFindFast('name', 'Patrick Erin Bruno')
    console.timeEnd('lookupF')
    console.log('find.length', find.length)

    //console.log('find', find)

    console.time('select')
    await farmers.select()
    console.timeEnd('select')
    //console.log('dat', dat)
}
index()
