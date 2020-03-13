const PORT = 8003

const http = require('http')
const urllib = require('url')
const fetch = require('node-fetch')
const fs = require('fs')

const PROXY_CONTENT_TYPE = {
  ".txt": "text/plain; charset=utf-8",
  ".js": "application/json; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
}

const taiwanmask = require('./taiwanmask.js')
taiwanmask.startUpdateMasksDataTaiwan()

const globalsafe = require('./globalsafe.js')
globalsafe.startUpdateGlobalSafeData()

const covid19tokyo = require('./covid19tokyo.js')
covid19tokyo.startUpdateCovid19TokyoData()

const covid19fukui = require('./covid19fukui.js')
const covid19tokushima = require('./covid19tokushima.js')
const covid19ishikawa = require('./covid19ishikawa.js')

const googlespreadsheet = require('./googlespreadsheet.js')

const fix0 = function(n, beam) {
  const s = "000000000" + n
  return s.substring(s.length - beam)
}
const getYMDH = function() {
  const t = new Date()
  return t.getFullYear() + fix0(t.getMonth() + 1, 2) + fix0(t.getDate(), 2) + fix0(t.getHours(), 2)
}
const countLog = function(name) {
  name = name.replace(/[\/|\¥|\?]/g, '-')
  console.log(name)
  const path = "countlog/" + name + "/"
  const fn = path + getYMDH() + ".txt"
  let n = 0
  try {
    n = parseInt(fs.readFileSync(fn, 'utf-8'))
  } catch (e) {
  }
  n++
  try {
    fs.writeFileSync(fn, "" + n, 'utf-8')
  } catch (e) {
    fs.mkdirSync(path, 0744)
    fs.writeFileSync(fn, "" + n, 'utf-8')
  }
}

const server = http.createServer()
server.on('request', async function(req, res) {
  if (req.url == "/favicon.ico") {
    res.end()
    return
  }
  if (req.url.startsWith("/img/") || req.url.endsWith(".css")) {
    serveStatic(res, req.url)
    return
  }
  countLog(req.url)

  if (req.url == '/api/taiwan_masks.json') {
    const data = await taiwanmask.getMasksDataTaiwan()
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify(data))
    return
  } else if (req.url.startsWith('/api/globalsafe.json')) {
    const params = urllib.parse(req.url, true)
    //console.log(params.query)
    const key = params.query.key || ""
    let limit = parseInt(params.query.limit) || 30
    if (limit > 1000)
      limit = 1000
    //console.log(key, limit)
    const data = globalsafe.getGlobalSafeDataByKeyword(key, limit)
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify(data))
    return
  } else if (req.url.startsWith('/api/covid19tokyo.json')) {
    const data = await covid19tokyo.getCovid19TokyoDataSummary()
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify(data))
    return
  } else if (req.url.startsWith('/api/covid19tokyo.txt')) {
    const data = await covid19tokyo.getCovid19TokyoDataSummaryForIchigoJam()
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' })
    res.end(data)
    return
  } else if (req.url.startsWith('/api/covid19fukui.json')) {
    const data = await covid19fukui.getCovid19FukuiDataSummary()
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify(data))
    return
  } else if (req.url.startsWith('/api/covid19fukui.txt')) {
    const data = await covid19fukui.getCovid19FukuiDataSummaryForIchigoJam()
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' })
    res.end(data)
    return
  } else if (req.url.startsWith('/api/covid19fukui-weekly.json')) {
    const data = await covid19fukui.getCovid19FukuiDataWeekly()
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify(data))
    return
  } else if (req.url.startsWith('/api/covid19tokushima.json')) {
    const data = await covid19tokushima.getCovid19DataDaily()
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify(data))
    return
  } else if (req.url.startsWith('/api/covid19tokushima.txt')) {
    const data = await covid19tokushima.getCovid19DataSummaryForIchigoJam()
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' })
    res.end(data)
    return
  } else if (req.url.startsWith('/api/covid19ishikawa.json')) {
    const data = await covid19ishikawa.getCovid19DataJSON()
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify(data))
    return
  } else if (req.url.startsWith('/api/covid19ishikawa.txt')) {
    const data = await covid19ishikawa.getCovid19DataSummaryForIchigoJam()
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' })
    res.end(data)
    return
  } else if (req.url.startsWith('/api/googlespreadsheet.json')) {
    const params = urllib.parse(req.url, true)
    const key = params.query.key
    const data = await googlespreadsheet.fetchCSVfromGoogleSpreadSheet(key)
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify(data))
    return
  } else if (req.url.startsWith('/proxy/')) {
    //countLog('proxy')
    const params = urllib.parse(req.url, true)
    const url = params.query.url
    //console.log(url)
    if (url) {
      const n = url.lastIndexOf('.')
      let ext = ".txt"
      if (n >= 0) {
        ext = url.substring(n)
      }
      const data = await (await fetch(url)).text()
      let ctype = PROXY_CONTENT_TYPE[ext]
      if (!ctype) {
        ctype = PROXY_CONTENT_TYPE[".txt"]
      }
      res.writeHead(200, { 'Content-Type': ctype, 'Access-Control-Allow-Origin': '*' })
      res.end(data)
      return
    }
  }
  console.log(req.url)
  res.end()
})
server.listen(PORT)

const CONTENT_TYPE = {
  'html' : 'text/html; charset=utf-8',
  'png' : 'image/png',
  'gif' : 'image/gif',
  'jpg' : 'image/jpeg',
  'txt' : 'text/plain',
  'js' : 'text/javascript',
  'json' : 'application/json',
  'jsonld' : 'application/ld+json',
  'csv' : 'text/csv',
  'css' : 'text/css',
  'pdf' : 'application/pdf',
  'ico' : 'image/vnd.microsoft.icon',
}

function serveStatic(res, fn) {
  fn = 'static' + fn
  if (fn.indexOf('..') >= 0) {
    return
  }
  if (fn.endsWith('/'))
    fn += "index.html"
  
  const ext = fn.substring(fn.lastIndexOf('.') + 1)
  let type = CONTENT_TYPE[ext]
  if (!type)
    type = 'text/plain'
  try {
    const b = fs.readFileSync(fn)
    res.writeHead(200, { 'Content-Type' : type })
    res.write(b)
  } catch (e) {
    res.writeHead(404)
  }
  res.end()
}
