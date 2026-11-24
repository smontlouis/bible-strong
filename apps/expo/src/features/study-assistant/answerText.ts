/**
 * An answer as it leaves the app, copied or shared. Its links to a card, a cited source or a
 * passage only mean something inside the conversation that holds them: their label stays, as text.
 */
const LOCAL_LINK =
  /\[([^\]\n]+)\]\(https:\/\/bible-strong\.app\/assistant-(?:widget|source|passage)\/[^)\s]*\)/g

export const answerPlainText = (text: string) => text.replace(LOCAL_LINK, '$1').trim()
