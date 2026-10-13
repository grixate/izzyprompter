import { BASE_PIXELS_PER_SECOND } from './motion.ts'
import { clamp } from './position.ts'

/** Preview state never touches persistence, sockets, or a paired session. */
export function previewFrame(position: number, maximum: number, speed: number, seconds: number) {
  return clamp(position + BASE_PIXELS_PER_SECOND * speed * Math.max(0, seconds), 0, maximum)
}

export const PREVIEW_SCRIPT = [
  'Find your rhythm. Keep your eyes on the lens.',
  'There is a moment before every recording when the room becomes unusually quiet. The camera is ready. The light is on. You know what you want to say, but the first line can still feel a little too far away.',
  'Then the words begin to move. Not quickly, not urgently. Just enough to meet you where you are. You take a breath, look forward, and begin a conversation with someone on the other side of the screen.',
  'A good story rarely arrives in one perfect take. Sometimes you find a better word halfway through a sentence. Sometimes you need a little more space between two thoughts. Sometimes you simply want to begin that paragraph again.',
  'There is nothing wrong with going back. The second telling often finds something the first one missed: a softer beginning, a clearer explanation, a moment that feels a little more like you.',
  'Think about the last conversation you enjoyed. You probably do not remember every word. You remember how the other person made you feel. The pauses mattered. The small details mattered. The way they listened mattered most of all.',
  'Speaking to a camera can feel different, but the person you are speaking to is still there. They may be watching from a kitchen table, sitting on a train, or taking a quiet moment between two busy parts of their day.',
  'You do not have to fill every second. A pause can carry a thought just as well as a sentence. Give an idea time to settle before moving to the next one. Let the rhythm follow the meaning, rather than the other way around.',
  'The tools around you should make that easier. The light helps people see you. The microphone helps them hear you. The words on the screen give you enough confidence to stop thinking about what comes next.',
  'What remains is the part that cannot be automated: your attention, your point of view, and the particular way you tell a story. That is why two people can read the same words and leave completely different impressions.',
  'Perhaps the most useful thing about a script is knowing that you can leave it for a moment. You can add a detail, change your mind, or let a thought find its own ending. The words will be waiting when you come back.',
  'And when you reach the last line, there is no need to rush it. Leave a little silence. Look at the lens as if someone you know is there. Because somewhere, on another screen, someone is.',
].join('\n\n')
