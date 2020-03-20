const cheerio = require('cheerio')
const util = require('./util.js')

const PREF = util.JAPAN_PREF
const PREF_EN = util.JAPAN_PREF_EN

const CACHE_TIME = 1 * 24 * 60 * 60 * 1000 // 1day
const PATH = 'data/bedforinfection/'
const URL = 'https://www.mhlw.go.jp/bunya/kenkou/kekkaku-kansenshou15/02-02.html'

const getData = async function(cachetime) {
  return await util.getWebWithCache(URL, PATH, cachetime, 'Shift_JIS')
}
const getJSON = async function(cachetime) {
  const data = await util.getCache(async function() {
    return JSON.stringify(await fetchJSON(cachetime))
  }, PATH, '.json', cachetime)
  return JSON.parse(data)
}
const startUpdate = function() {
  setInterval(async function() {
    await util.getWebWithCache(URL, PATH, CACHE_TIME)
  }, CACHE_TIME)
}
const filterElement = function(s) {
  s = s.trim()
  let s2 = util.toHalfNumber(s)
  s2 = s2.replace(/\,/g, "")
  const p = s2.match(/(\d+)床/)
  if (!p)
    return s
  return parseInt(p[1])
}
const parseTable = function(dom, tbl) {
  let state = 0
  const res = []
  const head = []
  dom('tr', '', tbl).each((idx, ele) => {
    if (state == 0) {
      dom('th', '', ele).each((idx, ele) => {
        head.push(filterElement(dom(ele).text()))
      })
      state = 1
    } else {
      const data = {}
      dom('td', '', ele).each((idx, ele) => {
        data[head[idx]] = filterElement(dom(ele).text())
      })
      res.push(data)
    }
  })
  return res
}
const parseTable2 = function(dom, tbl) {
  const head = []
  dom('th', '', dom('thead', '', tbl)).each((idx, ele) => {
    head.push(filterElement(dom(ele).text()))
  })
  const head2 = [ head[0], head[1], head[4], head[5], head[6], head[3] ]
  const res = []
  dom('tr', '', dom('tbody', '', tbl)).each((idx, ele) => {
    const data = {}
    dom('td', '', ele).each((idx, ele) => {
      data[head2[idx]] = filterElement(dom(ele).text())
    })
    res.push(data)
  })
  return res
}
const fetchJSON2 = async function(url) {
  const data = await util.getWebWithCache(url, PATH + "2/", CACHE_TIME, 'Shift_JIS')
  const dom = cheerio.load(data)
  const table = dom('table')[1]
  return parseTable2(dom, table)
}
const parseTitle = function(s) {
  // 感染症指定医療機関の指定状況（平成31年4月1日現在）
  const p = s.match(/(.+)（(..)(\d+)年(\d+)月(\d+)日現在）/)
  const y = parseInt(p[3]) + (p[2] == '平成' ? 2019 - 31 : 2019)
  const m = parseInt(p[4])
  const d = parseInt(p[5])
  const fix0 = util.fix0
  return [ p[1], y + "-" + fix0(m, 2) + "-" + fix0(d, 2) ]
}
const fetchJSON = async function(cachetime) {
  const data = await getData(cachetime)
  const dom = cheerio.load(data)
  const types = [ '特定感染症指定医療機関', '第一種感染症指定医療機関', '第二種感染症指定医療機関' ]
  const res = {}
  const title_dt = parseTitle(dom('h2').text())
  res.description = title_dt[0]
  res.lastUpdate = title_dt[1]
  const hosp = {}
  for (const type of types) {
    let url = null
    dom('h4').each((idx, ele) => {
      const e = dom(ele)
      const text = e.text()
      if (text.indexOf(type) == -1)
        return
      const href = dom('a', '', e).attr('href')
      if (!href) {
        const tbl = e.next('table')
        hosp[type] = parseTable(dom, tbl)
      } else {
        url = util.makeURL(URL, href)
      }
    })
    if (url)
      hosp[type] = await fetchJSON2(url)
  }
  res.hospitals = hosp
  res.summary = makeSummary(hosp)
  res.srcurl = URL
  return res
}
const makeSummary = function(data) {
  const parseNumber = function(s) {
    if (typeof s == 'number')
      return s
    return 0
  }
  const res = []
  for (let i = 0; i < PREF.length; i++) {
    const d = { name: PREF_EN[i], name_ja: PREF[i] }
    const sum = function(a, name) {
      let cnt = 0
      for (let i = 0; i < a.length; i++) {
        if (d.name_ja != a[i]['所在地'])
          continue
        const n = parseNumber(a[i][name])
        cnt += n
      }
      return cnt
    }
    d.sumt = sum(data['特定感染症指定医療機関'], '病床数')
    d.sum1 = sum(data['第一種感染症指定医療機関'], '病床数')
    d.sum2 = sum(data['第二種感染症指定医療機関'], '感染症病床')
    d.sumk = sum(data['第二種感染症指定医療機関'], '結核病床(稼働病床)')
    d.sums = sum(data['第二種感染症指定医療機関'], '一般病床又は精神病床')
    d.sumi = d.sumt + d.sum1 + d.sum2 + d.sumk
    d.sum = d.sumi + d.sums
    res.push(d)
  }
  const LABELS = {
    sum: '病床数合計',
    sumi: '感染症病床合計',
    sumt: '特定感染症指定医療機関 病床数',
    sum1: '第一種感染症指定医療機関 病床数',
    sum2: '第二種感染症指定医療機関 感染症病床',
    sumk: '第二種感染症指定医療機関 結核病床(稼働病床)',
    sums: '第二種感染症指定医療機関 一般病床又は精神病床',
  }
  const total = {}
  for (const name in LABELS) {
    total[name] = 0
    for (const d of res) {
      total[name] += d[name]
    }
  }
  return { label: LABELS, area: res, total: total }
}
const getSummaryJSON = async function() {
  return (await getJSON()).summary
}

const main = async function() {
  const data = await fetchJSON(1000 * 60)
  //const data = await getJSON()
  //const data = await fetchJSON2('https://www.mhlw.go.jp/bunya/kenkou/kekkaku-kansenshou15/02-02-01.html', '二種')
  console.log(data)
  //console.log(await getSummaryJSON())
}
if (require.main === module) {
  main()
} else {
  startUpdate()
}

exports.getJSON = getJSON
exports.getSummaryJSON = getSummaryJSON
