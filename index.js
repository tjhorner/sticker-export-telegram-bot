require("dotenv").config()

const Telegraf = require('telegraf')
const emoji = require('node-emoji')
const JSZip = require("jszip")
const request = require("request-promise-native").defaults({ encoding: null })
const fs = require("fs")
const sharp = require("sharp")

const bot = new Telegraf(process.env.BOT_TOKEN)
const tg = new Telegraf.Telegram(process.env.BOT_TOKEN)

bot.start((ctx) => ctx.reply('Welcome! Send me a sticker and I will send you a file with all the stickers in that pack, in WebP and PNG format, or in GZ-wrapped JSON files, if they\'re animated.'))
bot.help((ctx) => ctx.reply('Send me a sticker and I will send you a file with all the stickers in that pack, in WebP and PNG format, or in GZ-wrapped JSON files, if they\'re animated.'))
bot.on('sticker', async (ctx) => {
    ctx.reply("We're downloading your stickers...")
    var set = await tg.getStickerSet(ctx.update.message.sticker.set_name)
    console.log(`Sticker set ID: ${set.name},`, `title: ${set.title}`)
    var fileArray = [];
    var fileArray2 = [];
    var prom = new Promise((resolve, reject) => {
        set.stickers.forEach(async (s, i, a) => {
            var unemoji = emoji.unemojify(s.emoji).replace(/:/g, '')
            var fileName = `${set.name}-${i}-${unemoji}`
            var file = await tg.getFileLink(s.file_id)
            console.log(`Downloading #${i}: ${unemoji}...`)
            var fileB = await request(file)
            fileArray.push({ name: fileName, buffer: fileB })
            if (!s.is_animated) {
                console.log(`Making PNG of #${i}: ${unemoji}...`)
                var fileB2 = await sharp(fileB).png({
                    progressive: true,
                    adaptiveFiltering: true
                }).toBuffer()
                fileArray2.push({ name: fileName, buffer: fileB2 })
            }
            console.log(`#${i}: ${unemoji} downloaded!`)
            if (s.is_animated) {
                if (fileArray.length === a.length) resolve();
            } else {
                if (fileArray2.length === a.length) resolve();
            }
           
        })
    })


    await prom

    var zip = new JSZip();
    if (set.is_animated) {
        fileArray.forEach(element => {
            zip.file(element.name + (set.is_animated ? ".json.gz" : ".webp"), element.buffer)
        })
    } else {
        var webp = zip.folder("webp")
        var png = zip.folder("png")

        fileArray.forEach((element, index) => {
            webp.file(element.name + ".webp", element.buffer)
            png.file(fileArray2[index].name + ".png", fileArray2[index].buffer)
        })

    }


    var stream = zip.generateNodeStream({
        type: 'nodebuffer',
        streamFiles: true,
        compression: "DEFLATE",
        compressionOptions: {
            level: 9
        },
        comment: `Telegram sticker pack "${set.title}"`
    })
    console.log(`Sending file...`)
    ctx.reply("We're sending you a ZIP file...")
    ctx.replyWithDocument({
        source: stream,
        filename: `${set.name}.zip`
    })

})
bot.launch()
