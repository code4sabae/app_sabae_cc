const fs = require('fs')
const fetch = require('node-fetch')
const cheerio = require('cheerio')
const util = require('./util.js')
const pdf2text = require('./pdf2text.js')

const CACHE_TIME = 1 * 60 * 60 * 1000 // 1hour
//const CACHE_TIME = 1 * 60 * 1000 // 1min
const PATH = 'data/covid19japan/'
const URL = 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000164708_00001.html'
const BASEURL = 'https://www.mhlw.go.jp'

const getCovid19Data = async function() {
  return await util.getWebWithCache(URL, PATH)
}
const getLastUpdate = function(fn) {
  return util.getLastUpdateOfCache(URL, PATH)
}
const startUpdate = function() {
  setInterval(async function() {
    await util.getWebWithCache(URL, PATH, CACHE_TIME)
  }, CACHE_TIME)
}

const parseWeek = function(s) {
  s = util.toHalf(s)
  const n = s.indexOf('週')
  return s.substring(0, n)
}
// '国内事例における都道府県別の患者報告数（2020年3月13日12時時点）' -> 2020/03/09 09:00
const parseDate = function(s) {
  const fix0 = util.fix0
  //const num = s.match(/国内事例における都道府県別の患者報告数（(\d+)年(\d+)月(\d+)日(\d+)時時点）/)
  s = s.substring(s.lastIndexOf('（'))
  let num = s.match(/（(\d+)年(\d+)月(\d+)日(\d+)時時点）/)
  if (num) {
    const y = parseInt(num[1])
    const m = parseInt(num[2])
    const d = parseInt(num[3])
    const h = parseInt(num[4])
    return y + "-" + fix0(m, 2) + "-" + fix0(d, 2) + "T" + fix0(h, 2) + ":00"
  }
  num = s.match(/（(\d+)年(\d+)月(\d+)日掲載分）/)
  if (num) {
    const y = parseInt(num[1])
    const m = parseInt(num[2])
    const d = parseInt(num[3])
    return y + "-" + fix0(m, 2) + "-" + fix0(d, 2)
  }
  return "--"
//  console.log(s, num)
}

const getDataJSON = async function(title, text2json) {
  const data = await getCovid19Data()
  const dom = cheerio.load(data)
  const weeks = []
  const res = {}
  dom('a').each((idx, ele) => {
    if (ele.children.length == 0)
      return
    const text = ele.children[0].data
    if (text && text.startsWith(title)) {
      res.dt = parseDate(text)
      const href = dom(ele).attr("href")
      res.url = href.startsWith("https://") ? href : BASEURL + href
    }
  })
  return await getJSONbyPDF(text2json, res.dt, res.url)
}
const getJSONbyPDF = async function(text2json, dt, url) {
  if (dt.endsWith(":00"))
    dt = dt.substring(0, dt.length - 3)
  const fn = PATH + dt
  try {
    const data = fs.readFileSync(fn + ".json")
    return JSON.parse(data)
  } catch (e) {
  }
  const pdf = await (await fetch(url)).arrayBuffer()
	fs.writeFileSync(fn + ".pdf", new Buffer.from(pdf), 'binary')
  const txt = await pdf2text.pdf2text(fn + ".pdf")
  const json = text2json(txt, url, dt)
  fs.writeFileSync(fn + ".json", JSON.stringify(json))
  return json
}

//
const parseNumber = function(s) {
  //console.log(s)
  const num = s.match(/.+ (\d+) 名/)
  //console.log(s, num)
  return parseInt(num[1])
}
const PREF = [ "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県" ]
const PREF_EN = [ "Hokkaido", "Aomori", "Iwate", "Miyagi", "Akita", "Yamagata", "Fukushima", "Ibaraki", "Tochigi", "Gunma", "Saitama", "Chiba", "Tokyo", "Kanagawa", "Niigata", "Toyama", "Ishikawa", "Fukui", "Yamanashi", "Nagano", "Gifu", "Shizuoka", "Aichi", "Mie", "Shiga", "Kyoto", "Osaka", "Hyogo", "Nara", "Wakayama", "Tottori", "Shimane", "Okayama", "Hiroshima", "Yamaguchi", "Tokushima", "Kagawa", "Eihime", "Kochi", "Fukuoka", "Saga", "Nagasaki", "Kumamoto", "Oita", "Miyazaki", "Kagoshima", "Okinawa" ]
const text2jsonWithoutCruise = function(txt, url, dt) {
  const res = {}
  const ss = txt.split('\n')
  res.srcurl_pdf = url
  res.srcurl_web = URL
  res.description = ss[0] + ss[1]
  res.lastUpdate = dt
  res.npatients = parseNumber(ss[2])
  const pref = []
  for (let i = 0; i < PREF.length; i++) {
    let cnt = 0
    for (let j = 3; j <= ss.length; j++) {
      if (ss[j] && ss[j].indexOf(PREF[i]) >= 0) {
        cnt = parseNumber(ss[j])
      }
    }
    pref[i] = { name: PREF_EN[i], name_jp: PREF[i], npatients: cnt }
  }
  res.area = pref
  return res
}
const text2jsonWithInspections = function(txt, url, dt) {
  const parsePeopleCount = function(s) {
    const n = parseInt(s)
    if (s == n) {
      return n
    }
    return s
  }

  const res = {}
  const ss = txt.split('\n')
  /*
  let desc = ""
  for (let i = 25; i < ss.length - 3; i++)
    desc += ss[i]
  */
  let title = ""
  for (let i = ss.length - 3; i < ss.length; i++)
    title += ss[i]
  //res.title = title
  res.srcurl_pdf = url
  res.srcurl_web = URL
  res.description = title // desc
  res.lastUpdate = dt
  res.npatients = 0
  res.ninspections = 0

  const area = []
  for (let i = 0; i < PREF.length; i++) {
    area[i] = { name: PREF_EN[i], name_jp: PREF[i] }
  }
  area[47] = { name: 'Japan', name_jp: "合計" }
  for (let i = 1; i <= 48 / 2; i++) {
    const ss2 = ss[i].split(' ')
    const area1 = area[i - 1]
    const area2 = area[i - 1 + 24]
    for (let j = 0; j < ss2.length; j++) {
      if (ss2[j] == area1.name_jp) {
        area1.npatients = parsePeopleCount(ss2[j + 1])
        area1.ninspections = parsePeopleCount(ss2[j + 2])
      } else if (ss2[j] == area2.name_jp) {
        area2.npatients = parsePeopleCount(ss2[j + 1])
        area2.ninspections = parsePeopleCount(ss2[j + 2])
      }
    }
  }
  res.npatients = area[47].npatients
  res.ninspections = area[47].ninspections
  area.pop()
  res.area = area
  return res
}
//
const getCovid19DataSummaryForIchigoJam = async function() {
  const json = await getCovid19DataJSON()
  const summary = {}
  summary.lastUpdate = json.lastUpdate
  summary.Japan = json.npatients
  for (let i = 0; i < json.area.length; i++) {
    summary[json.area[i].name] = json.area[i].npatients
  }
  return util.simplejson2txt(summary)
}
//
const getCovid19DataJSON = async function(type) {
  if (type == 'withpcr') {
    return await getDataJSON('新型コロナウイルス陽性者数とPCR検査実施人数（都道府県別）', text2jsonWithInspections)
  }
  return await getDataJSON('国内事例における都道府県別の患者報告数', text2jsonWithoutCruise)
}

const test = async function() {
  const fn = "data/covid19japan/2020-03-13"
  const txt = await pdf2text.pdf2text(fn + ".pdf")
  const json = text2jsonWithInspections(txt, "url", "2020-03-13")
  console.log(json)
}
const main = async function() {
  //test()
  //return

  await util.getWebWithCache(URL, PATH, CACHE_TIME)
  const data = await getCovid19DataJSON()
  console.log(data)
  console.log(await getCovid19DataSummaryForIchigoJam())
  const data1 = await getCovid19DataJSON('withpcr')
  console.log(data1)
}
if (require.main === module) {
  main()
} else {
  startUpdate()
}

exports.getCovid19DataJSON = getCovid19DataJSON
exports.getCovid19DataSummaryForIchigoJam = getCovid19DataSummaryForIchigoJam
