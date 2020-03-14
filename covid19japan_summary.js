const fs = require('fs')
const fetch = require('node-fetch')
const cheerio = require('cheerio')
const util = require('./util.js')
const jimp = require("jimp")
const img2text = require('./img2text.js')

const PATH = 'data/covid19japan/'
const URL = 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000164708_00001.html'
const BASEURL = 'https://www.mhlw.go.jp'

const getCovid19Data = async function() {
  return await util.getWebWithCache(URL, PATH)
}

const getCovid19DataJSON = async function() {
  const data = await getCovid19Data()
  const dom = cheerio.load(data)
  const weeks = []
  const res = {}
  let state = 0
  let url = null
  dom('.m-grid__col1').each((idx, ele) => {
    for (let i = 0; i < ele.children.length; i++) {
      if (state == 0) {
        const text = ele.children[i].data
        if (text && text.trim() == '入退院の状況は以下の通りです。') {
          state = 1
        }
      } else if (state == 1) {
        const tag = ele.children[i].name
        if (tag == 'a' && ele.children[i].children) {
          const tag2 = ele.children[i].children[0].name
          if (tag2 == 'img') {
            const fn = dom(ele.children[i].children[0]).attr('src')
            url = BASEURL + fn
            state = 2
          }
        }
      }
    }
  })
  return await getJSONbyImage(url)
}
const getCurrentPatients = async function(fn) {
  const jpg = await jimp.read(fn)
  const crops = [
    [ 'lastUpdate', 1573, 112, 2116 - 1573, 178 - 115 ],
    [ 'npatients', 60, 400, 500, 90 ],
    [ 'nexits', 620, 400, 530, 90 ],
    [ 'ndeaths', 1180, 400, 464, 90 ],
    [ 'ncurrentpatients', 1686, 400, 584, 90 ],
    [ 'nlighters', 1686, 582, 584, 60 ],
  ]
  // 3A12H (WN) 18
  const reformatdate = function(s) {
    s = s.replace(/ /g, "")
    const num = s.match(/(\d+)A(\d+)([^\d]*)\(.+\)(\d+)/)
    if (!num)
      return "--"
    const m = parseInt(num[1])
    const d = num[3].length == 0 ? Math.floor(parseInt(num[2]) / 10) : parseInt(num[2])
    const h = parseInt(num[4])
    const y = new Date().getFullYear()
    if (m == 12 && new Date().getMonth() == 0) // 年末対策?
      y--
    const fix0 = (n) => n < 10 ? "0" + n : "" + n
    return y + "-" + fix0(m) + "-" + fix0(d) + "T" + fix0(h) + ":00"
  }
  const reformatnum = function(s) {
    s = s.replace(/ /g, "")
    const num = s.match(/(\d+).+/)
    if (!num)
      return "-"
    return num[1]
  }
  const res = {}
  for (const crop of crops) {
    const imgc = jpg.clone()
    const name = crop[0]
    imgc.crop(crop[1], crop[2], crop[3], crop[4])
    const text = await img2text.img2text(imgc)
    res[name] = name == 'lastUpdate' ? reformatdate(text) : reformatnum(text)
  }
  return res
}
const getJSONbyImage = async function(url) {
  const fn = PATH + url.substring(url.lastIndexOf('/') + 1)
  try {
    const data = fs.readFileSync(fn + ".json")
    return JSON.parse(data)
  } catch (e) {
  }
  const img = await (await fetch(url)).arrayBuffer()
	fs.writeFileSync(fn, new Buffer.from(img), 'binary')
  const json = await getCurrentPatients(fn)
  fs.writeFileSync(fn + ".json", JSON.stringify(json))
  return json
}
const getCovid19DataSummaryForIchigoJam = async function() {
  const json = await getCovid19DataJSON()
  return util.simplejson2txt(json)
}

const main = async function() {
  const data = await getCovid19DataJSON()
  console.log(data)
  console.log(await getCovid19DataSummaryForIchigoJam())
}
if (require.main === module) {
  main()
} else {
}

exports.getCovid19DataJSON = getCovid19DataJSON
exports.getCovid19DataSummaryForIchigoJam = getCovid19DataSummaryForIchigoJam
