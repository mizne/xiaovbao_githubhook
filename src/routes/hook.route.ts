import * as Router from 'koa-router'
import axios from 'axios'

const router = new Router()

router.post('/githubhook', (ctx, next) => {
  console.log(ctx.request.body)

  ctx.body = {
    result: 'ok'
  }
})

export default router
