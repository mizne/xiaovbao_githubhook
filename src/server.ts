import * as Koa from 'koa'

const port = 8888
import bindMilldewares from './middlewares'
import bindRoutes from './routes'

const app = new Koa()

bindMilldewares(app)

bindRoutes(app)

app.listen(8888, () => {
  console.log(`listening on port: ${8888} !!!`)
})
