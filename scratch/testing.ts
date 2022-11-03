import * as fs from 'fs'
import * as path from 'path'
import * as stream from 'stream'
import { Buffer } from 'buffer'

// const fileStream= fs.createReadStream("small.txt",{encoding:'binary'});
// const writeStream= fs.createWriteStream("smallt.txt",{encoding:'binary'});

// const uppercase = new stream.Transform({
//   transform(chunk, encoding, callback) {
//     callback(null, chunk.toString().toUpperCase());
//   },
// });

// fileStream.pipe(writeStream);
// const buff0 =Buffer.from('ff👵🏽👵🏽👵ñ')
const buff0 = Buffer.allocUnsafe(4) //being overwritten so is fine
buff0.writeInt32LE(Number.MAX_SAFE_INTEGER - 1)
console.log(buff0.length, buff0)
// const buff1 =Buffer.from('ff👵🏽👵🏽👵ñ')
// const buff2 =Buffer.from([121, 104,119])
// const row = Buffer.concat([buff1,blank,buff2])
// const padding = Buffer.alloc(100-row.length)
// wstream.write(Buffer.concat([row,padding]));

let i = 200000
// var wstream = fs.createWriteStream('myBinaryFile',{encoding:'utf8',flags:'a'});
// while(i>0){
// // // creates random Buffer of 100 bytes
// var blank = Buffer.alloc(4)
// // create another Buffer of 100 bytes and write
// const buff1 =Buffer.from('ff👵🏽👵🏽👵ñ')
// const buff2 =Buffer.from([121, 104,119])
// const row = Buffer.concat([buff1,blank,buff2])
// const padding = Buffer.alloc(100-row.length)
// wstream.write(Buffer.concat([row,padding]));
// //console.log(row.length)
// i--;
// }
// wstream.end()
// wstream.close();

// //reading file speed test
// console.time()
// const str= fs.createReadStream('myBinaryFile',{start:2000_000,end:2000_099}); //A
// // const str= fs.createReadStream('myBinaryFile'); //B
// let chunks=''
// str.on('data',chunk=>chunks+=chunk.toString('utf-8')); //A & B
// str.on('end',()=>{console.log(chunks,chunks.length);console.timeEnd()}); //A 5.609ms
// // str.on('end',()=>{console.log(chunks.substring(2000000,2000099),chunks.length);console.timeEnd()}); //B 1.888s

// // const f=fs.readFileSync('myBinaryFile',{encoding:'utf8'}) //C
// // console.log(f.substring(200000,200099)); console.timeEnd() //C 885.356ms

const STRING = 'ff👵🏽👵🏽👵ñ'
const encodings: BufferEncoding[] = ['utf8', 'ucs2', 'utf16le', 'ascii', 'binary', 'hex']

// encodings.forEach((enc)=>{
//     const fileStream= fs.createReadStream('moji',{encoding:'utf-8'});
//     fileStream.on('data',chunk=>{
//         process.stdout.write(enc+': '+chunk.length+' '+chunk.toString(enc)+'\n')
//         const writeStream= fs.createWriteStream(enc,{encoding:enc});
//         writeStream.write(chunk.toString())
//     });
//     // const rStream = fs.createReadStream(path.join(__dirname,'..',enc),{
//     //     highWaterMark:1000,
//     // })
//     // rStream.on('data',chunk=>console.log(enc+': ',chunk.toString(enc),chunk.length));
// })

// const read = fs.createReadStream(path.join(__dirname,'..','binary'),{
//     highWaterMark:1000,
//     //encoding:'utf-8'
//     //start:2
// })

// read.on('data',chunk=>{
//     console.log('chunk',chunk.length);
//     const word = chunk.toString('binary')
//     console.log('word',word);
//     // process.stdout.write(word)
//     // process.stdout.write('-')
// })
