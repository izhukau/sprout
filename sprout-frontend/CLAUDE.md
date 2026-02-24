# Sprout - AI-Powered Adaptive Learning Platform

## Project Overview
Sprout is a hackathon project (single user, no auth). It builds personalised learning pathways on any topic using seven Claude-powered agents that autonomously generate 3D knowledge graphs, diagnostic assessments, and interactive tutoring.

## Inspiration
Getting stuck on homework used to mean trawling through textbooks or finding a teacher on their lunch break. That struggle produced real learning. When AI arrived, any solution became one chat away — and learning suffered. Oxford University Press found 80% of students rely on AI for schoolwork and 62% say it's making them worse at learning. AI tools are here to stay; the question is how students use them. Sprout is a personal AI tutor focused on building understanding, not just giving answers.

## What it does
Describe a topic, upload notes, and watch Sprout's multi-agent system autonomously generate a 3D learning network that adapts to you. Explore your knowledge graph using natural hand movements via OpenCV hand tracking. Dive into concept nodes to learn through quiz, code, text, and drawing-based blocks. An integrated chat and voice tutor (ElevenLabs) guides learners to reach answers themselves.

## Architecture
- **Frontend**: Next.js 16 + React, Three.js/React Flow for graph rendering, OpenCV hand tracking via WebSocket
- **Backend**: Express 5 + TypeScript, Drizzle ORM + SQLite, Anthropic SDK for Claude agents
- **Single user**: Hardcoded DEFAULT_USER_ID (`00000000-0000-0000-0000-000000000000`), auto-seeded on backend startup
- **Backend lives at**: `../sprout-backend`

## Agents (all in `sprout-backend/src/agents/`)
1. **Topic Agent** — Breaks topics into 6-10 concepts with prerequisite edges
2. **Subconcept Bootstrap Agent** — Generates 8-12 subconcepts + diagnostic questions per concept
3. **Concept Refinement Agent** — Personalises subconcept graph based on diagnostic performance
4. **Tutor Chat Agent** — Teaches subconcepts chunk-by-chunk with exercises
5. **Grade Answers Agent** — Grades diagnostic answers with scores and feedback
6. **Generate Diagnostic Agent** — Creates MCQ + open-ended diagnostic questions
7. **Review Learning Path Agent** — Post-completion enrichment and remediation

## Key patterns
- Agents use tool-calling loops (agent-loop.ts) with Claude, persisting via tools (not return values)
- Real-time SSE streaming for graph mutations (node_created, edge_created, etc.)
- DAG-based learning graphs (not linear sequences)
- Chunk-based tutoring with text/code/draw question types
