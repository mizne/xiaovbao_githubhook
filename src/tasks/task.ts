import * as shell from 'shelljs'
import * as path from 'path'
import * as fs from 'fs'
import * as moment from 'moment'
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

export interface UploadSentryTaskOptions {
  projectName: string
  jsUrlPrefix: string
  localJsMapRelateDistDir: string
}

export interface UploadSentryOptions extends UploadSentryTaskOptions {
  version: string
  repositoryDir: string
}

export interface NormalizedParams {
  projectName: string
  needUploadSourceMapToSentry: boolean
  jsUrlPrefix: string
  localJsMapRelateDistDir: string
  destDistDir: string
  repositoryDir: string
  repositoryDistDir: string
}

// TODO 某些步骤容易出错 加上重试机制 譬如pull from github容易失败
export class Task {
  constructor(private options: string | UploadSentryTaskOptions) {}

  async run() {
    const params = this.resolveOptions(this.options)

    try {
      shell.echo(`run task staring!!! project name: ${params.projectName}! time: ${moment().format('YYYY-MM-DD HH:mm:ss')}`)
      const version = await this.pullFromGithub(
        params.projectName,
        params.repositoryDir
      )
      await this.runInstall(params.projectName, params.repositoryDir)
      await this.runBuild(params.projectName, params.repositoryDir)
      this.copyToDestination(
        params.projectName,
        params.repositoryDistDir,
        params.destDistDir
      )
      if (params.needUploadSourceMapToSentry) {
        await this.uploadSourceMapToSentry({
          ...(this.options as UploadSentryTaskOptions),
          repositoryDir: params.repositoryDir,
          version
        })
      }
      shell.echo(`run task success!!! project name: ${params.projectName}! time: ${moment().format('YYYY-MM-DD HH:mm:ss')}`)
    } catch (e) {
      shell.echo(
        `run task failed!!! error: ${e.message}; project name: ${
          params.projectName
        }! time: ${moment().format('YYYY-MM-DD HH:mm:ss')}`
      )
    }
  }

  private resolveOptions(
    opt: string | UploadSentryTaskOptions
  ): NormalizedParams {
    const projectName =
      typeof this.options === 'string' ? this.options : this.options.projectName
    const needUploadSourceMapToSentry = typeof this.options !== 'string'
    const jsUrlPrefix =
      typeof this.options !== 'string' ? this.options.jsUrlPrefix : ''
    const localJsMapRelateDistDir =
      typeof this.options !== 'string'
        ? this.options.localJsMapRelateDistDir
        : ''

    const destDistDir = path.join(
      frontEndDir,
      repositoryMap[projectName] + '/dist'
    )
    const repositoryDir = path.join(
      frontEndDir,
      repositoryMap[projectName],
      'repository',
      projectName
    )
    const repositoryDistDir = path.join(repositoryDir, 'dist')

    return {
      projectName,
      needUploadSourceMapToSentry,
      jsUrlPrefix,
      localJsMapRelateDistDir,
      destDistDir,
      repositoryDir,
      repositoryDistDir
    }
  }

  private pullFromGithub(
    projectName: string,
    repositoryDir: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      shell.echo(`start pull from github, project name: ${projectName}`)
      shell.cd(repositoryDir)
      shell.exec(`git pull origin master master`, code => {
        if (code === 0) {
          const packageJson = fs.readFileSync(
            repositoryDir + '/package.json',
            'utf-8'
          )
          const version = JSON.parse(packageJson).version
          shell.echo(
            `fetch package version from ${repositoryDir}; version: ${version}`
          )
          shell.echo(`git pull success`)
          resolve(version)
        } else {
          reject(
            new Error(`pull from github failed; project name: ${projectName};`)
          )
        }
      })
    })
  }

  private runInstall(
    projectName: string,
    repositoryDir: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      shell.echo(`start npm install, project name: ${projectName}`)
      shell.cd(repositoryDir)
      shell.exec(`npm install`, code => {
        if (code === 0) {
          shell.echo(`npm install success`)
          resolve()
        } else {
          reject(new Error(`npm install failed; project name: ${projectName};`))
        }
      })
    })
  }

  private runBuild(projectName: string, repositoryDir: string) {
    return new Promise((resolve, reject) => {
      shell.echo(`start npm run build, project name: ${projectName}`)
      shell.cd(repositoryDir)
      shell.exec(`npm run build`, code => {
        if (code === 0) {
          shell.echo(`npm run build success`)
          resolve()
        } else {
          reject(
            new Error(`npm run build failed; project name: ${projectName};`)
          )
        }
      })
    })
  }

  private copyToDestination(
    projectName: string,
    repositoryDistDir: string,
    destDistDir: string
  ) {
    shell.echo(`start copy build dist to destination dist dir`)
    shell.rm('-rf', destDistDir + '/*')
    shell.cp('-R', repositoryDistDir + '/*', destDistDir)
    shell.echo(
      `copy build dist to destination dist dir success; project name: ${projectName};`
    )
  }

  private async uploadSourceMapToSentry({
    projectName,
    version,
    repositoryDir,
    jsUrlPrefix,
    localJsMapRelateDistDir
  }: UploadSentryOptions) {
    if (!version) {
      throw new Error(`upload source map to sentry need version`)
    }
    shell.echo(
      `start upload source map to sentry; project name: ${projectName}`
    )
    await this.sentryReleaseVersion(projectName, version).then(() =>
      this.uploadSourceMap({
        projectName,
        version,
        repositoryDir,
        jsUrlPrefix,
        localJsMapRelateDistDir
      })
    )
    shell.echo(
      `upload source map to sentry success!!! project name: ${projectName}!!!`
    )
  }

  private sentryReleaseVersion(
    projectName: string,
    version: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      shell.exec(
        `sentry-cli releases -o ${sentryOrganizer} -p ${
          sentryProjectMap[projectName]
        } new ${version}`,
        code => {
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`sentry releases version failed!!!`))
          }
        }
      )
    })
  }

  private uploadSourceMap({
    projectName,
    version,
    repositoryDir,
    jsUrlPrefix,
    localJsMapRelateDistDir
  }: UploadSentryOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      shell.cd(repositoryDir)
      shell.exec(
        `sentry-cli releases -o ${sentryOrganizer} -p ${
          sentryProjectMap[projectName]
        } files ${version} upload-sourcemaps --url-prefix ${jsUrlPrefix} ${localJsMapRelateDistDir}`,
        code => {
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`upload source map to sentry failed;`))
          }
        }
      )
    })
  }
}
