import { globby } from 'globby'
import prompts from 'prompts'
import ghPages from 'gh-pages'
import path from 'path'
import fs from 'fs'

async function main() {
    // 1. Find all package.json files in packages/*
    const packageJsonPaths = await globby('packages/*/package.json')

    // 2. Extract package names
    const packages = packageJsonPaths.map((pkgPath) => {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
        return {
            name: pkg.name,
            path: path.dirname(pkgPath),
        }
    })

    if (packages.length === 0) {
        console.error('No packages found in packages/* directory')
        process.exit(1)
    }

    // 3. Prompt user to select package
    const { package: pkg } = await prompts({
        type: 'select',
        name: 'package',
        message: 'Select package to publish:',
        choices: packages.map((pkg) => ({
            title: pkg.name,
            value: pkg,
        })),
    })

    if (!pkg) {
        console.log('No package selected')
        process.exit(0)
    }

    const defaultMessage = `Publish ${pkg.name} from koka-stack repository`

    const { message } = await prompts({
        type: 'text',
        name: 'message',
        message: `Enter commit message for ${pkg.name}:`,
        initial: defaultMessage,
    })

    // 4. Publish using gh-pages
    const repo = `https://github.com/koka-ts/${pkg.name}.git`

    console.log(`Publishing ${pkg.name}...`, {
        path: pkg.path,
        repo,
    })

    await ghPages.publish(
        pkg.path,
        {
            repo: repo,
            branch: 'main',
            message: message || defaultMessage,
            dotfiles: true,
        },
        (err) => {
            if (err) {
                console.error('Publish failed:', err)
                process.exit(1)
            }
            console.log('Published successfully!')
        },
    )
}

main().catch(console.error)
