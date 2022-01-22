const fs = require('fs')
const path = require('path')
const os = require('os')

function log (message) {
  console.log(`[dotenv][DEBUG] ${message}`)
}

const NEWLINE = '\n'
const RE_INI_KEY_VAL = /^\s*([\w.-]+)\s*=\s*("[^"]*"|'[^']*'|[^#]*)?(\s*|\s*#.*)?$/
const RE_NEWLINES = /\\n/g

// \r: 回车 \n: 换行
const NEWLINES_MATCH = /\r\n|\n|\r/

// Parses src into an Object

// 1. src 是env文件的内容，以\n隔开的
// 示例："DB_HOST='localhost'\n\nDB_USER=\"root\"\n\nDB_PASS=s1mpl3\n"
// 2. options 传入的参数，默认不传为：{ debug: false, multiline: false}
function parse (src, options) {
  const debug = Boolean(options && options.debug)
  const multiline = Boolean(options && options.multiline)
  const obj = {}

  // convert Buffers before splitting into lines and processing

  // lines: 
  /* [
    "DB_HOST='localhost'",
    "",
    "DB_USER=\"root\"",
    "",
    "DB_PASS=s1mpl3",
    "",
  ]*/
  const lines = src.toString().split(NEWLINES_MATCH)

  for (let idx = 0; idx < lines.length; idx++) {
    // line: "DB_HOST='localhost'"
    let line = lines[idx]

    // matching "KEY' and 'VAL' in 'KEY=VAL'

    // keyValueArr: 
    /* [
      "DB_HOST='localhost'",
      "DB_HOST",
      "'localhost'",
      undefined,
    ]*/
    const keyValueArr = line.match(RE_INI_KEY_VAL)
    // matched?
    if (keyValueArr != null) {
      // key: "DB_HOST"
      const key = keyValueArr[1]
      // default undefined or missing values to empty string
      // val: "'localhost'"
      let val = (keyValueArr[2] || '')
      // end: 10
      let end = val.length - 1
      // 如果都有双引号
      // isDoubleQuoted: false
      const isDoubleQuoted = val[0] === '"' && val[end] === '"'

      // 如果都有单引号
      // isSingleQuoted: true
      const isSingleQuoted = val[0] === "'" && val[end] === "'"

      // 如果只有一个双引号
      // isMultilineDoubleQuoted: false
      const isMultilineDoubleQuoted = val[0] === '"' && val[end] !== '"'

      // 如果只有一个单引号
      // isMultilineSingleQuoted: false
      const isMultilineSingleQuoted = val[0] === "'" && val[end] !== "'"

      // if parsing line breaks and the value starts with a quote
      if (multiline && (isMultilineDoubleQuoted || isMultilineSingleQuoted)) {
        const quoteChar = isMultilineDoubleQuoted ? '"' : "'"

        val = val.substring(1)

        while (idx++ < lines.length - 1) {
          line = lines[idx]
          end = line.length - 1
          if (line[end] === quoteChar) {
            val += NEWLINE + line.substring(0, end)
            break
          }
          val += NEWLINE + line
        }
      // if single or double quoted, remove quotes
      // 如果有引号包裹，去掉引号
      } else if (isSingleQuoted || isDoubleQuoted) {
        // old val: "'localhost'"
        // newval: "localhost"
        val = val.substring(1, end)

        // if double quoted, expand newlines
        if (isDoubleQuoted) {
          val = val.replace(RE_NEWLINES, NEWLINE)
        }
      } else {
        // remove surrounding whitespace
        val = val.trim()
      }

      obj[key] = val
    } else if (debug) {
      const trimmedLine = line.trim()

      // ignore empty and commented lines
      if (trimmedLine.length && trimmedLine[0] !== '#') {
        log(`Failed to match key and value when parsing line ${idx + 1}: ${line}`)
      }
    }
  }

  return obj
}

// envPath: ".env.dev"
function resolveHome (envPath) {
  // 判断第一个字符是否是家目录
  return envPath[0] === '~' ? path.join(os.homedir(), envPath.slice(1)) : envPath
}

// Populates process.env from .env file
function config (options) {
  // dotenvPath: 获取env文件的绝对路径: "/Users/flora/www/freetime/learndotenv/.env"
  // process.cwd(): 返回的是当前Node.js进程执行时的工作目录 -> "/Users/flora/www/freetime/learndotenv"
  let dotenvPath = path.resolve(process.cwd(), '.env')
  let encoding = 'utf8'
  // debug 默认false
  const debug = Boolean(options && options.debug)
  // override 默认false
  const override = Boolean(options && options.override)
  // multiline 默认false
  const multiline = Boolean(options && options.multiline)

  if (options) {
    // 如果有指定的env文件
    if (options.path != null) {
      // dotenvPath: ".env.dev"
      dotenvPath = resolveHome(options.path)
    }
    if (options.encoding != null) {
      encoding = options.encoding
    }
  }

  try {
    // specifying an encoding returns a string instead of a buffer
    // parsed: 解析到的键值obj
    // DotenvModule 包含了 config 和 parse 两个方法
    // fs.readFileSync(dotenvPath, { encoding }:  按 utf-8 解析文件，得到对象
    const parsed = DotenvModule.parse(fs.readFileSync(dotenvPath, { encoding }), { debug, multiline })

    Object.keys(parsed).forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
        process.env[key] = parsed[key]
      } else {
        if (override === true) {
          process.env[key] = parsed[key]
        }

        if (debug) {
          if (override === true) {
            log(`"${key}" is already defined in \`process.env\` and WAS overwritten`)
          } else {
            log(`"${key}" is already defined in \`process.env\` and was NOT overwritten`)
          }
        }
      }
    })

    return { parsed }
  } catch (e) {
    if (debug) {
      log(`Failed to load ${dotenvPath} ${e.message}`)
    }

    return { error: e }
  }
}

const DotenvModule = {
  config,
  parse
}

module.exports = DotenvModule
