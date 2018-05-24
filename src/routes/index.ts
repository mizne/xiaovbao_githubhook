import * as fs from 'fs'
import * as Koa from 'koa'
import * as Router from 'koa-router'

const files = fs.readdirSync(__dirname)

export default function(app: Koa) {
  files.filter(e => e.endsWith('.route.js')).forEach(e => {
    const router: Router = require('./' + e).default
    app.use(router.routes()).use(router.allowedMethods())
  })
}
