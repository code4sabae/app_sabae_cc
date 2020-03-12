const PORT = 8003

const fs = require('fs')
// const url = require('url')
const fetch = require('node-fetch')

function saveData(fn, data) {
  fs.writeFileSync('data/taiwanmask/' + fn, data)
  //JSON.stringify(data))
}
function loadData(fn) {
  return fs.readFileSync('data/taiwanmask/' + fn, 'utf-8')
//  alldata = JSON.parse(fs.readFileSync(PATH_DATA)).results.bindings
}

const convertCSVtoArray = function(s) {
	const lines = s.split("\n")
	const res = []
	for (let i = 0; i < lines.length; i++) {
		const ar = lines[i].split(",")
		res.push(ar)
	}
	return res
}
const fix0 = function(n, beam) {
  const s = "000000000" + n
  return s.substring(s.length - beam)
}
const getYMDH = function() {
  const t = new Date()
  return t.getFullYear() + fix0(t.getMonth() + 1, 2) + fix0(t.getDate(), 2) + fix0(t.getHours(), 2)
}
const fetchMaskData = async function() {
  const URL = 'https://data.nhi.gov.tw/resource/mask/maskdata.csv'
  const data = await (await fetch(URL)).text()
  return data
}
const FN_TAIWAN_MASK = 'taiwan-maskdata.csv'
const getMaskData = async function() {
  const fn = getYMDH() + "-" + FN_TAIWAN_MASK
  try {
    const data = loadData(fn)
    return data
  } catch (e) {
    const data = await fetchMaskData()
    saveData(fn, data)
    return data
  }
}
const startUpdateMasksDataTaiwan = function() {
  console.log("start job getMaskData")
  setInterval(function() {
    getMaskData()
  }, 5 * 60 * 1000) // every 5min
}

const getMasksDataTaiwan = async function() {
  const csv = await getMaskData()
  const data = convertCSVtoArray(csv)
  //console.log(data)

	/*
	醫事機構代碼,醫事機構名稱,醫事機構地址,醫事機構電話,成人口罩剩餘數,兒童口罩剩餘數,來源資料時間
	医療機関のコード,医療機関の名前,医療機関の住所,医療機関の電話番号,成人マスクの残り数,子供マスクの残り数,ソースデータ時間
	*/

	const area = {}
	let cnta = 0
  let cntc = 0
  const normalizeAdr = function(adr) {
    adr = adr.replace(/巿/g, '市')
    adr = adr.replace(/臺/g, '台')
    adr = adr.replace(/縣/g, '県')
    return adr
  }
	for (let i = 1; i < data.length; i++) {
		const d = data[i]
		if (d.length < 7)
			continue
		const adr = normalizeAdr(d[2])
		const maska = parseInt(d[4])
		const maskc = parseInt(d[5])

		cnta += maska
		cntc += maskc

		const sep = '市県區'
		const maxm = 0xffff
		let m = 0xffff
		for (let i =  0; i < sep.length; i++) {
			const mm = adr.indexOf(sep.charAt(i))
			if (mm >= 0 && mm < m)
				m = mm
		}
		if (m == maxm) {
			console.log('error', adr)
		} else {
      const city = adr.substring(0, m + 1)
			const c = area[city]
			if (!c) {
				area[city] = { cnta: maska, cntc: maskc }
			} else {
				c.cnta += maska
				c.cntc += maskc
			}
		}
	}
	const lastupdate = data[1][6].trim()

	//console.log(cnta, cntc, area)
	return { cnta: cnta, cntc: cntc, area: area, lastupdate: lastupdate }
}

const AREA_TAIWAN = "連江県	金門県	桃園市	台北市	新北市	基隆市	苗栗県	新竹市	新竹県	宜蘭県	彰化県	台中市	南投県	花蓮県	澎湖県	雲林県	嘉義市	嘉義県	台南市	高雄市	屏東県	台東県".split('\t')

const len = function(json) {
  let n = 0
  for (const a in json)
    n++
  return n
}
const test = async function() {
  const data = await getMasksDataTaiwan()
  console.log(data)
  console.log(AREA_TAIWAN)
  A: for (const a in data.area) {
    for (let i = 0; i < AREA_TAIWAN.length; i++) {
      if (AREA_TAIWAN[i] == a) {
        console.log("hit " + a)
        continue A
      }
    }
    console.log("!" + a)
    /*
!台南東區
!淡水區
!桃園県
!彰化市
!台南県
!高雄県
!屏東市
!花蓮市
!台東市
    */
  }
  console.log(len(data.area))
}

exports.getMasksDataTaiwan = getMasksDataTaiwan
exports.startUpdateMasksDataTaiwan = startUpdateMasksDataTaiwan