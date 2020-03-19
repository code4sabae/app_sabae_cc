const fs = require('fs')
const fetch = require('node-fetch')

exports.simplejson2txt = function(json) {
  if (typeof json == 'string') {
    json = JSON.parse(json)
  }
  const res = []
  for (const name in json) {
    res.push(name)
    res.push(json[name])
  }
  res.splice(0, 0, res.length / 2)
  res.push('')
  return res.join('\r\n')
}
exports.convertCSVtoArray = function(s) {
	const lines = s.split("\n")
	const res = []
	for (let i = 0; i < lines.length; i++) {
		const ar = lines[i].split(",")
		res.push(ar)
	}
	return res
}
exports.fix0 = function(n, beam) {
  const s = "000000000" + n
  return s.substring(s.length - beam)
}
exports.formatYMDHMS = function(t) {
  const fix0 = exports.fix0
  return t.getFullYear() + "-" + fix0(t.getMonth() + 1, 2) + "-" + fix0(t.getDate(), 2) + "T" + fix0(t.getHours(), 2) + ":" + fix0(t.getMinutes(), 2) + ":" + fix0(t.getSeconds(), 2)
}
exports.getYMDHMS = function() {
  const t = new Date()
  const fix0 = exports.fix0
  return t.getFullYear() + fix0(t.getMonth() + 1, 2) + fix0(t.getDate(), 2) + fix0(t.getHours(), 2) + fix0(t.getMinutes(), 2) + fix0(t.getSeconds(), 2)
}
exports.getYMDH = function() {
  const t = new Date()
  const fix0 = exports.fix0
  return t.getFullYear() + fix0(t.getMonth() + 1, 2) + fix0(t.getDate(), 2) + fix0(t.getHours(), 2)
}
exports.getYMD = function() {
  const t = new Date()
  const fix0 = exports.fix0
  return t.getFullYear() + fix0(t.getMonth() + 1, 2) + fix0(t.getDate(), 2)
}
exports.cutNoneN = function(s) {
  s = exports.toHalf(s)
  const n = parseInt(s.replace(/[^\d]/g, ""))
  if (isNaN(n))
    return 0
  return n
}
exports.toHalf = function(s) {
  const ZEN = "０１２３４５６７８９（）／"
  const HAN = "0123456789()/"
  let s2 = ""
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i)
    const n = ZEN.indexOf(c)
    if (n >= 0) {
      s2 += HAN.charAt(n)
    } else {
      s2 += c
    }
  }
  return s2
}
exports.mkdirSyncForFile = function(fn) {
  const dirs = fn.split('/')
  let dir = ""
  for (let i = 0; i < dirs.length - 1; i++) {
    dir += dirs[i] + "/"
    try {
      fs.mkdirSync(dir, 0744)
    } catch (e) {
    }
  }
}
exports.getExtFromURL = function(url) {
  let ext = ".txt"
  const n = url.lastIndexOf('/')
  const webfn = url.substring(n)
  const m = webfn.lastIndexOf('.')
  if (m >= 0) {
    ext = webfn.substring(m)
  }
  return ext
}
exports.getWebWithCache = async function(url, path, cachetime) {
  const ext = exports.getExtFromURL(url)
  const fnlatest = path + "_latest" + ext
  const fn = path + exports.getYMDHMS() + ext
  let cache = null
  //console.log(fn, cachetime)
  try {
    const modtime = fs.statSync(fnlatest).mtime
    const dt = new Date().getTime() - new Date(modtime).getTime()
    //console.log(dt, new Date(modtime).getTime(), new Date().getTime())
    cache = fs.readFileSync(fnlatest, 'utf-8')
    if (!cachetime || dt < cachetime) {
      //console.log("use cache")
      return cache
    }
  } catch (e) {
  }
  const data = await (await fetch(url)).text()
  if (data == cache) {
    //console.log("same as cache")
    //fs.writeFileSync(fnlatest, data)
    return cache
  }
  //console.log("use original")
  try {
    fs.writeFileSync(fnlatest, data)
    fs.writeFileSync(fn, data)
  } catch (e) {
    exports.mkdirSyncForFile(fn)
    fs.writeFileSync(fnlatest, data)
    fs.writeFileSync(fn, data)
  }
  //console.log("write", fn)
  return data
}
exports.getCache = async function(asyncfetch, path, ext, cachetime) {
  const fnlatest = path + "_latest" + ext
  const fn = path + exports.getYMDHMS() + ext
  let cache = null
  //console.log(fn, cachetime)
  try {
    const modtime = fs.statSync(fnlatest).mtime
    const dt = new Date().getTime() - new Date(modtime).getTime()
    //console.log(dt, new Date(modtime).getTime(), new Date().getTime())
    cache = fs.readFileSync(fnlatest, 'utf-8')
    if (!cachetime || dt < cachetime) {
      //console.log("use cache")
      return cache
    }
  } catch (e) {
  }
  let data = await asyncfetch()
  if (data == cache) {
    //console.log("same as cache")
    //fs.writeFileSync(fnlatest, data)
    return cache
  }
  //console.log("use original")
  try {
    fs.writeFileSync(fnlatest, data)
    fs.writeFileSync(fn, data)
  } catch (e) {
    exports.mkdirSyncForFile(fn)
    fs.writeFileSync(fnlatest, data)
    fs.writeFileSync(fn, data)
  }
  //console.log("write", fn)
  return data
}
exports.getLastUpdateOfCache = function(url, path) {
  const fnlatest = path + "_latest" + exports.getExtFromURL(url)
  try {
    const modtime = fs.statSync(fnlatest).mtime
    const d = new Date(modtime)
    return exports.formatYMDHMS(d)
  } catch (e) {
  }
  return null
}

exports.JAPAN_PREF = [ "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県" ]
exports.JAPAN_PREF_EN = [ "Hokkaido", "Aomori", "Iwate", "Miyagi", "Akita", "Yamagata", "Fukushima", "Ibaraki", "Tochigi", "Gunma", "Saitama", "Chiba", "Tokyo", "Kanagawa", "Niigata", "Toyama", "Ishikawa", "Fukui", "Yamanashi", "Nagano", "Gifu", "Shizuoka", "Aichi", "Mie", "Shiga", "Kyoto", "Osaka", "Hyogo", "Nara", "Wakayama", "Tottori", "Shimane", "Okayama", "Hiroshima", "Yamaguchi", "Tokushima", "Kagawa", "Eihime", "Kochi", "Fukuoka", "Saga", "Nagasaki", "Kumamoto", "Oita", "Miyazaki", "Kagoshima", "Okinawa" ]

const test = async function() {
  console.log(exports.formatYMDHMS(new Date()))
}

if (require.main === module) {
  test()
} else {
}
