import * as shell from 'shelljs'
import * as path from 'path'
import * as fs from 'fs'
import { frontEndDir } from '../../config/config'

// github project name vs local folder name
const repositoryMap: { [key: string]: string } = {
  'organizer-management': 'huizhanren-management',
  'ex-show-web': 'ex-show'
}

const sentryOrganizer = 'tenswin'
// github project name vs sentry project name
const sentryProjectMap: { [key: string]: string } = {
  'ex-show-web': 'exshow'
}

// TODO 某些步骤容易出错 加上重试机制 譬如pull from github容易失败
export class Task {
  private destDistDir: string
  private repositoryDir: string
  private repositoryDistDir: string
  private version: string
  constructor(
    private projectName: string,
    private needUploadSourceMapToSentry?: boolean,
    private jsUrlPrefix?: string, // http://exshow.xiaovbao.cn/static/js
    private localJsMapRelateDistDir?: string // dist/static/js
  ) {
    this.destDistDir = path.join(
      frontEndDir,
      repositoryMap[projectName] + '/dist'
    )
    this.repositoryDir = path.join(
      frontEndDir,
      repositoryMap[projectName],
      'repository',
      projectName
    )
    this.repositoryDistDir = path.join(this.repositoryDir, 'dist')
    console.log(`destDistDir: ${this.destDistDir}`)
    console.log(`repositoryDir: ${this.repositoryDir}`)
    console.log(`repositoryDistDir: ${this.repositoryDistDir}`)
  }

  async run() {
    try {
      shell.echo(`run task staring!!! project name: ${this.projectName}`)
      await this.pullFromGithub()
      await this.runInstall()
      await this.runBuild()
      this.copyToDestination()
      if (this.needUploadSourceMapToSentry) {
        await this.uploadSourceMapToSentry()
      }
      shell.echo(`run task success!!! project name: ${this.projectName}`)
    } catch (e) {
      console.log(`run task failed; error: ${e.message}`)
    }
  }

  private pullFromGithub(): Promise<void> {
    return new Promise((resolve, reject) => {
      shell.echo(`start pull from github, project name: ${this.projectName}`)
      shell.cd(this.repositoryDir)
      shell.exec(`git pull origin master master`, code => {
        if (code === 0) {
          const packageJson = fs.readFileSync(
            this.repositoryDir + '/package.json',
            'utf-8'
          )
          this.version = JSON.parse(packageJson).version
          console.log(
            `fetch package version from ${this.repositoryDir}; version: ${
              this.version
            }`
          )
          shell.echo(`git pull success`)
          resolve()
        } else {
          console.log(
            `pull from github failed; project name: ${this.projectName};`
          )
          reject(
            new Error(
              `pull from github failed; project name: ${this.projectName};`
            )
          )
        }
      })
    })
  }

  private runInstall(): Promise<void> {
    return new Promise((resolve, reject) => {
      shell.echo(`start npm install, project name: ${this.projectName}`)
      shell.cd(this.repositoryDir)
      shell.exec(`npm install`, code => {
        if (code === 0) {
          shell.echo(`npm install success`)
          resolve()
        } else {
          reject(
            new Error(`npm install failed; project name: ${this.projectName};`)
          )
        }
      })
    })
  }

  private runBuild() {
    return new Promise((resolve, reject) => {
      shell.echo(`start npm run build, project name: ${this.projectName}`)
      shell.cd(this.repositoryDir)
      shell.exec(`npm run build`, code => {
        if (code === 0) {
          shell.echo(`npm run build success`)
          resolve()
        } else {
          reject(
            new Error(
              `npm run build failed; project name: ${this.projectName};`
            )
          )
        }
      })
    })
  }

  private copyToDestination() {
    shell.echo(`start copy build dist to destination dist dir`)
    shell.rm('-rf', this.destDistDir + '/*')
    shell.cp('-R', this.repositoryDistDir + '/*', this.destDistDir)
    console.log(
      `copy build dist to destination dist dir success; project name: ${
        this.projectName
      };`
    )
  }

  private uploadSourceMapToSentry(): Promise<void> {
    return new Promise((resolve, reject) => {
      shell.echo(
        `start upload source map to sentry; project name: ${this.projectName}`
      )

      if (!this.version) {
        throw new Error(`upload source map to sentry need version`)
      }
      shell.exec(
        `sentry-cli releases -o ${sentryOrganizer} -p ${
          sentryProjectMap[this.projectName]
        } new ${this.version}`,
        releaseCode => {
          if (releaseCode === 0) {
            shell.cd(this.repositoryDir)
            shell.exec(
              `sentry-cli releases -o ${sentryOrganizer} -p ${
                sentryProjectMap[this.projectName]
              } files ${this.version} upload-sourcemaps --url-prefix ${
                this.jsUrlPrefix
              } ${this.localJsMapRelateDistDir}`,
              uploadCode => {
                if (uploadCode === 0) {
                  console.log(`upload source map to sentry success!!!`)
                  resolve()
                } else {
                  reject(new Error(`upload source map to sentry failed;`))
                }
              }
            )
          } else {
            reject(new Error(`sentry-cli releases new version failed;`))
          }
        }
      )
    })
  }
}
