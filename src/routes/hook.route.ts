import * as Router from 'koa-router'
import axios from 'axios'
import { Task } from '../tasks/task'

const router = new Router()

router.post('/helper/githubhook', (ctx, next) => {
  const repositoryName = ctx.request.body.repository.name
  console.log(`github hook from repository: ${repositoryName}`)

  if (repositoryName === 'ex-show-web') { // need upload source map to sentry
    const task = new Task(repositoryName, true, 'http://exshow.xiaovbao.cn/static/js', 'dist/static/js')
    task.run()
  } else {
    const task = new Task(repositoryName)
    task.run()
  }

  ctx.body = {
    result: 'ok'
  }
})

export default router
