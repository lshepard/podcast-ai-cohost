We are creating a podcast that has a human host and an AI companion. This application will host the AI companion, and help with research and recording the episodes.

## Workflow

This application is modeled off Descript, but with more control. I envision two columns running through the product - draft text, audio, and transcript, in parallel down the page. I can edit the episode first by creating draft script.

We build the podcast episode piece by piece. So I want a screen that lets me add segments one at a time. So there is an "Add Segment" button at the bottom (initially, that is the only button).

When you click Add Segment, then choose Human or Bot.

For Human, I can record audio, hit stop. The audio should then appear, so I can play it back.

For Bot, I can optionally add a prompt, or just generate the next phrase. It will include the full conversation to date as context, as well as other context and prompts that will be defined in Python. The Python backend lets me change the target LLM. Start with OpenAI o4 but then proceed to others as neeeded.

When the Bot text is generated, it should give an opportunity to edit the text. Then, Generate AI speech using Elevenlabs.


## Tech Stack 

Written in Python.

The application will run locally, via Docker and can be deployed. Initially, simple HTTP basic auth protection is fine.

