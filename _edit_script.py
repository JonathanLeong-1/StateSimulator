import sys

file_path = '.github/agents/backend-lead.agent.md'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Change 1: Remove 'edit, ' from tools line
content = content.replace(
    'tools: [read, edit, search, execute, agent, web, todo, askQuestions]',
    'tools: [read, search, execute, agent, web, todo, askQuestions]'
)

# Change 4: Add two constraint lines after last constraint
old4 = '- Keep each feature branch focused on one concern\n'
new4 = old4 + '- You do NOT have the `edit` tool \u2014 delegate all file creation/modification to sub-agents\n- Before EVERY action, verify: "Is this my job or a sub-agent' + "'" + 's job?" If sub-agent' + "'" + 's, invoke via `runSubagent`\n'
content = content.replace(old4, new4)

# Change 3: Insert NOTE before memory log line
old3 = 'Before starting work, READ your memory log to review prior sessions and avoid repeating mistakes.'
new3 = '**NOTE**: Since you do not have the `edit` tool, use the terminal append commands shown in the "Writing Your Session Log" section above.\n\n' + old3
content = content.replace(old3, new3)

with open(file_path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print('Changes 1, 3, 4 applied successfully')