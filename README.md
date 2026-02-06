# pplx

Modern CLI for the Perplexity AI API. Search, query, reason, and research from your terminal.

## Install

**Requires Node.js 20+**

### From npm

```bash
npm install -g @pruddiman/pplx
```

### From source

```bash
git clone https://github.com/PatrickRuddiman/pplx.git
cd pplx
npm install
npm run install:global
```

This builds the project and installs `pplx` as a global command. To uninstall:

```bash
npm run uninstall:global
```

### Development (symlink)

For active development, use `npm link` so changes are reflected immediately after rebuild:

```bash
npm install
npm run link          # builds and symlinks pplx globally
npm run dev           # watch mode - rebuilds on file changes
```

To remove the symlink:

```bash
npm run unlink
```

### Run without installing

```bash
npx @pruddiman/pplx "What is quantum computing?"
```

## Setup

Get an API key from [perplexity.ai/account/api](https://www.perplexity.ai/account/api), then:

```bash
pplx config set-key YOUR_API_KEY
```

Or set the environment variable:

```bash
export PERPLEXITY_API_KEY=your-key-here
```

## Usage

### Quick Query (Default)

```bash
pplx "What is the capital of France?"
```

No subcommand needed - just pass your question directly.

### Query with Options

```bash
# Use a specific model
pplx query "Explain quantum computing" --model sonar-pro

# Disable streaming (wait for full response)
pplx query "Write a haiku" --no-stream

# Save response to file
pplx query "Summarize recent AI news" --output summary.txt

# Academic search mode
pplx query "CRISPR gene therapy trials" --search-mode academic

# Filter by recency
pplx query "Latest TypeScript features" --recency week

# Restrict to specific domains
pplx query "React best practices" --domain reactjs.org --domain github.com

# Show related follow-up questions
pplx query "Climate change effects" --related

# Use reasoning model with high effort
pplx query "Analyze trade-offs of microservices" --model sonar-reasoning-pro --reasoning high

# Raw output for piping
pplx query "List 10 programming languages" --raw | head -5
```

### Search

Get search results with sources:

```bash
pplx search "renewable energy trends 2026"
pplx search "machine learning papers" --mode academic
pplx search "SEC filings Tesla" --mode sec
pplx search "news today" --recency day --json
```

### Deep Research

Run expert-level research (async, may take minutes):

```bash
# Start research and wait for results
pplx research start "Comprehensive analysis of mRNA vaccine technology"

# Start research without waiting
pplx research start "Topic" --no-wait

# Check status
pplx research status <request-id>

# Get completed results
pplx research get <request-id> --output report.txt

# Shorthand
pplx research "Topic"
```

### Conversation Threads

Continue previous conversations:

```bash
pplx query "What is Rust?"
pplx query "How does its borrow checker work?" --continue
pplx query "Compare it to C++" --thread <thread-id>
```

### Other Commands

```bash
# List available models
pplx models

# View query history
pplx history
pplx history --limit 50
pplx history --threads
pplx history --clear

# Configuration
pplx config set-key <key>
pplx config view-key
pplx config clear-key
pplx config set model sonar-pro      # Change default model
pplx config set contextSize high     # Change default search depth
pplx config list
pplx config path
```

## Models

| Model | Type | Best For |
|-------|------|----------|
| `sonar` | Search | Quick queries, summaries, current events |
| `sonar-pro` | Search | Complex queries, follow-ups, 2x citations |
| `sonar-reasoning-pro` | Reasoning | Step-by-step analysis, logical problem-solving |
| `sonar-deep-research` | Research | Comprehensive reports, multi-source synthesis |

## Query Options

| Flag | Description |
|------|-------------|
| `-m, --model <model>` | Model to use (default: sonar) |
| `-s, --stream` | Stream response in real-time (default) |
| `--no-stream` | Wait for complete response |
| `-o, --output <file>` | Save response to file |
| `--search-mode <mode>` | web, academic, or sec |
| `--recency <period>` | hour, day, week, month, year |
| `--after <date>` | Results after date (YYYY-MM-DD) |
| `--before <date>` | Results before date (YYYY-MM-DD) |
| `--domain <domains...>` | Include only these domains |
| `--exclude-domain <domains...>` | Exclude these domains |
| `--images` | Include images (sonar-pro only) |
| `--related` | Show related questions |
| `--reasoning <effort>` | minimal, low, medium, high |
| `--context-size <size>` | Search depth: low, medium, high |
| `--language <code>` | Response language |
| `--system <prompt>` | Custom system prompt |
| `--json` | JSON output format |
| `--no-citations` | Hide citation sources |
| `--no-search` | Disable web search |
| `--safe-search` | Enable safe search |
| `--raw` | Raw text output (no formatting) |
| `-c, --continue` | Continue last conversation |
| `-t, --thread <id>` | Continue a specific thread |

## Global Options

| Flag | Description |
|------|-------------|
| `--api-key <key>` | Override stored API key |
| `--verbose` | Show debug output |
| `--no-color` | Disable colors |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PERPLEXITY_API_KEY` | API key (overrides stored config) |
| `PERPLEXITY_MODEL` | Default model |
| `PERPLEXITY_CONFIG_DIR` | Custom config directory |
| `NO_COLOR` | Disable colors |

## License

MIT
