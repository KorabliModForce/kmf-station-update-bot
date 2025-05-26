import { Octokit } from 'octokit'
import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { bearerAuth } from 'hono/bearer-auth'
import { swaggerUI } from '@hono/swagger-ui'

const KMF_STATION_URL_BASE = Deno.env.get('KMF_STATION_URL_BASE')
if (!KMF_STATION_URL_BASE) {
  console.warn('KMF_STATION_URL_BASE not specified')
}

const SECRET = Deno.env.get('SECRET')
if (!SECRET) {
  console.warn('SECRET not specified')
}

const KMF_STATION_SECRET = Deno.env.get('KMF_STATION_SECRET')
if (!KMF_STATION_SECRET) {
  console.warn('KMF_STATION_SECRET not specified')
}

const VERSION_REGEX = /[0-9]+\.[0-9]+\.([0-9]+)\.([0-9]+).[a-zA-Z]+/

const octokit = new Octokit({ auth: Deno.env.get('GITHUB_TOKEN') })

const crons: Record<
  string,
  { schedule: string | Deno.CronSchedule; handler: () => Promise<void> }
> = {
  'korabli-lesta-l10n': {
    schedule: { hour: { every: 6 } },
    handler: async () => {
      const ghRes = await octokit.request(
        'GET /repos/{owner}/{repo}/releases/latest',
        {
          owner: 'LocalizedKorabli',
          repo: 'Korabli-LESTA-L10N',
          headers: {
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      )

      const archive = ghRes.data.assets.find(({ name }) =>
        name.endsWith('.zh.mod.zip')
      )
      if (!archive) {
        console.warn('Latest releases do not have a valid archive!')
        return
      }
      const ghVersion = archive.name.replace(/\.mod\.zip$/, '')
      console.info('GitHub latest version:', ghVersion)

      const preStRes = await fetch(
        new URL(
          `/mod/korabli-lesta-l10n/${ghVersion}, '')}`,
          KMF_STATION_URL_BASE
        ),
        {
          redirect: 'manual',
        }
      )
      console.debug(
        'station redirect location',
        preStRes.headers.get('location')
      )
      const stVersion = preStRes.headers
        .get('location')
        ?.match(VERSION_REGEX)?.[0]
      console.info('Station latest version:', stVersion)
      if (stVersion) {
        const stVersionMatch = stVersion.match(VERSION_REGEX)
        const ghVersionMatch = ghVersion.match(VERSION_REGEX)
        console.debug('matches', stVersionMatch, ghVersionMatch)
        if (stVersionMatch && ghVersionMatch) {
          if (
            Number.parseInt(stVersionMatch[1]) >
              Number.parseInt(ghVersionMatch[1]) ||
            Number.parseInt(stVersionMatch[2]) >=
              Number.parseInt(ghVersionMatch[2])
          ) {
            console.info('Already latest.')
            return
          }
        }
      }

      const blob = await (await fetch(archive.browser_download_url)).blob()
      console.info('Get blob.')

      const stRes = await fetch(
        new URL(
          `/mod/korabli-lesta-l10n/${ghVersion}, '')}`,
          KMF_STATION_URL_BASE
        ),
        {
          method: 'POST',
          headers: {
            'content-type': 'application/octet-stream',
            authorization: `Bearer ${KMF_STATION_SECRET}`,
          },
          body: blob,
        }
      )

      if (!stRes.ok) {
        console.warn('Update failed: ', await stRes.text())
        return
      }

      console.info('Update succeed.')
    },
  },
}

const app = new OpenAPIHono()

app.openAPIRegistry.registerComponent('securitySchemes', 'Bearer', {
  type: 'http',
  scheme: 'bearer',
})

app.openapi(
  createRoute({
    method: 'post',
    path: '/update',
    middleware: [bearerAuth({ token: SECRET! })],
    security: [{ Bearer: [] }],
    request: {},
    responses: {
      200: {
        description: 'Update task emitted.',
      },
      401: {
        description: 'Unauthorized.',
      },
    },
  }),
  async c => {
    for (const [name, { handler }] of Object.entries(crons)) {
      console.info('Update:', name)
      await handler()
    }
    return c.body(null)
  }
)

app.doc('/doc', {
  info: {
    title: 'Kmf Station Update Bot',
    version: 'v1',
  },
  openapi: '3.1.0',
})

app.get('/swagger-ui', swaggerUI({ url: '/doc' }))

Deno.serve(app.fetch)

for (const [name, { schedule, handler }] of Object.entries(crons)) {
  Deno.cron(name, schedule, handler)
}
