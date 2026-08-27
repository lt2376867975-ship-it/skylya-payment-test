import { useMemo, useState } from 'react'
import manifest from '../data/type-manifest.json'

const ANSWERS = [
  { value: -3, label: '非常偏向左侧' },
  { value: -2, label: '比较偏向左侧' },
  { value: -1, label: '稍微偏向左侧' },
  { value: 1, label: '稍微偏向右侧' },
  { value: 2, label: '比较偏向右侧' },
  { value: 3, label: '非常偏向右侧' },
]

const QUESTIONS = [
  {
    prompt: '关系刚开始升温时，你更常主动推进关系吗？例如主动联系、提出见面，或让关系更明确。',
    leftLabel: '非常像我',
    rightLabel: '完全不像我',
    left: 'lead',
    right: 'companion',
    axis: 0,
  },
  {
    prompt: '在稳定关系里，周末约会或活动安排通常更接近哪种情况？',
    leftLabel: '我更常主动提出',
    rightLabel: '我更常等对方提出',
    left: 'lead',
    right: 'companion',
    axis: 0,
  },
  {
    prompt: '当两个人想法不一致时，你通常更倾向于哪种方式？',
    leftLabel: '尊重对方决定',
    rightLabel: '主动做出决定',
    left: 'companion',
    right: 'lead',
    axis: 0,
  },
  {
    prompt: '在一段亲密关系中，我希望伴侣是一位能给我方向，带我向前走的人。',
    leftLabel: '非常像我',
    rightLabel: '完全不像我',
    left: 'companion',
    right: 'lead',
    axis: 0,
  },
  {
    prompt: '确定关系之后，你的情感投入节奏通常更接近哪一边？',
    leftLabel: '慢慢观察，逐步投入',
    rightLabel: '很快进入深度投入',
    left: 'buffer',
    right: 'anchor',
    axis: 1,
  },
  {
    prompt: '如果对方突然变冷淡，你通常会怎么反应？',
    leftLabel: '主动沟通，想尽快弄清原因',
    rightLabel: '后退保护自己',
    left: 'anchor',
    right: 'buffer',
    axis: 1,
  },
  {
    prompt: '当你很喜欢对方，但发现关系中存在难以解决的现实阻碍（例如父母、工作、性格、三观）时，你通常会？',
    leftLabel: '评估后及时止损',
    rightLabel: '继续投入，较难抽离',
    left: 'buffer',
    right: 'anchor',
    axis: 1,
  },
  {
    prompt: '对于 club、bar、KTV、水烟吧等夜间娱乐场所，你的态度更接近哪一边？',
    leftLabel: '比较愿意尝试',
    rightLabel: '不太喜欢这类场景',
    left: 'dynamic',
    right: 'stable',
    axis: 2,
  },
  {
    prompt: '当关系中出现矛盾时，你更舒服的处理节奏是？',
    leftLabel: '尽快讲清楚并解决',
    rightLabel: '先缓一缓，等情绪稳定再处理',
    left: 'anchor',
    right: 'buffer',
    axis: 1,
  },
  {
    prompt: '关于两个人之后怎么发展，你更舒服的是哪一种？',
    leftLabel: '心里有大致方向和计划',
    rightLabel: '先自然相处，不急着确定方向',
    left: 'stable',
    right: 'dynamic',
    axis: 2,
  },
  {
    prompt: '稳定关系中，约会吃饭或出游时，你更倾向于？',
    leftLabel: '尝试没去过的新地方',
    rightLabel: '选择熟悉且体验不错的地方',
    left: 'dynamic',
    right: 'stable',
    axis: 2,
  },
  {
    prompt: '如果周五晚上临时决定和伴侣来一场说走就走的短途旅行，你的感受更接近哪一边？',
    leftLabel: '太突然，会有点不适应',
    rightLabel: '很喜欢这种即兴感',
    left: 'stable',
    right: 'dynamic',
    axis: 2,
  },
]

const AXES = [
  { id: 'position', left: 'lead', right: 'companion', diff: ['lead', 'companion'], letters: ['L', 'C'], max: 12 },
  { id: 'emotion', left: 'anchor', right: 'buffer', diff: ['anchor', 'buffer'], letters: ['A', 'B'], max: 12 },
  { id: 'rhythm', left: 'stable', right: 'dynamic', diff: ['stable', 'dynamic'], letters: ['S', 'D'], max: 12 },
]

const TIE_BREAKERS = [
  {
    axis: 0,
    prompt: '当关系需要更进一步时，你更自然的反应是？',
    leftLabel: '主动把想法说清楚',
    rightLabel: '等对方先表达或靠近',
    letters: ['L', 'C'],
  },
  {
    axis: 1,
    prompt: '当关系变得更亲近时，哪种状态更容易让你感到消耗？',
    leftLabel: '想靠近但得不到回应',
    rightLabel: '对方靠近太快让我有压力',
    letters: ['A', 'B'],
  },
  {
    axis: 2,
    prompt: '长期相处中，哪种关系节奏会让你更舒服？',
    leftLabel: '有稳定预期和安排',
    rightLabel: '保持弹性和新鲜感',
    letters: ['S', 'D'],
  },
]

const initialScores = () => ({
  lead: 0,
  companion: 0,
  anchor: 0,
  buffer: 0,
  stable: 0,
  dynamic: 0,
})

function scoreAnswers(answers) {
  const scores = initialScores()
  answers.forEach((value, index) => {
    if (value == null) return
    const question = QUESTIONS[index]
    if (value < 0) scores[question.left] += Math.abs(value)
    else scores[question.right] += value
  })
  return scores
}

function buildResult(answers, tieLetters) {
  const scores = scoreAnswers(answers)
  const diffs = AXES.map((axis) => scores[axis.diff[0]] - scores[axis.diff[1]])
  const letters = diffs.map((diff, index) => {
    if (diff > 0) return AXES[index].letters[0]
    if (diff < 0) return AXES[index].letters[1]
    return tieLetters[index] ?? AXES[index].letters[0]
  })
  const confidence = Object.fromEntries(AXES.map((axis, index) => [axis.id, Math.min(1, Math.abs(diffs[index]) / axis.max)]))
  const boundary = Object.fromEntries(AXES.map((axis, index) => [axis.id, Math.abs(diffs[index]) <= 1]))

  return {
    code: letters.join(''),
    scores,
    diffs,
    confidence,
    boundary,
    answers,
    tieBreakers: tieLetters,
    completedAt: new Date().toISOString(),
  }
}

function saveResult(result) {
  try {
    sessionStorage.setItem('skylya-test-result', JSON.stringify(result))
  } catch {
    /* sessionStorage may be unavailable in private contexts. */
  }
}

export default function TestView({ onOpenType }) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState(() => Array(QUESTIONS.length).fill(null))
  const [tieAxes, setTieAxes] = useState([])
  const [tieIndex, setTieIndex] = useState(0)
  const [tieLetters, setTieLetters] = useState({})
  const isTieBreak = tieAxes.length > 0
  const tieQuestion = isTieBreak ? TIE_BREAKERS[tieAxes[tieIndex]] : null
  const current = isTieBreak ? tieQuestion : QUESTIONS[index]
  const selected = isTieBreak ? tieLetters[tieQuestion.axis] : answers[index]
  const totalSteps = QUESTIONS.length + tieAxes.length
  const currentStep = isTieBreak ? QUESTIONS.length + tieIndex + 1 : index + 1
  const progress = (currentStep / totalSteps) * 100
  const contextLabel = useMemo(() => {
    if (isTieBreak) return manifest.axes[tieQuestion.axis].label
    return manifest.axes[current.axis].label
  }, [current, isTieBreak, tieQuestion])

  const finish = (nextTieLetters = tieLetters) => {
    const result = buildResult(answers, nextTieLetters)
    saveResult(result)
    onOpenType(result.code)
  }

  const choose = (value) => {
    if (isTieBreak) {
      const letter = value < 0 ? tieQuestion.letters[0] : tieQuestion.letters[1]
      setTieLetters((currentLetters) => ({ ...currentLetters, [tieQuestion.axis]: letter }))
      return
    }
    setAnswers((currentAnswers) => currentAnswers.map((answer, i) => i === index ? value : answer))
  }

  const next = () => {
    if (selected == null) return
    if (isTieBreak) {
      if (tieIndex === tieAxes.length - 1) finish()
      else setTieIndex((currentIndex) => currentIndex + 1)
      return
    }
    if (index < QUESTIONS.length - 1) {
      setIndex((currentIndex) => currentIndex + 1)
      return
    }

    const scores = scoreAnswers(answers)
    const pendingTieAxes = AXES
      .map((axis, axisIndex) => [axisIndex, scores[axis.diff[0]] - scores[axis.diff[1]]])
      .filter(([, diff]) => diff === 0)
      .map(([axisIndex]) => axisIndex)
    if (pendingTieAxes.length > 0) {
      setTieAxes(pendingTieAxes)
      setTieIndex(0)
    } else {
      finish({})
    }
  }

  const back = () => {
    if (isTieBreak) {
      if (tieIndex > 0) setTieIndex((currentIndex) => currentIndex - 1)
      else {
        setTieAxes([])
        setTieIndex(0)
        setIndex(QUESTIONS.length - 1)
      }
      return
    }
    if (index > 0) setIndex((currentIndex) => currentIndex - 1)
  }

  const reset = () => {
    setAnswers(Array(QUESTIONS.length).fill(null))
    setIndex(0)
    setTieAxes([])
    setTieIndex(0)
    setTieLetters({})
  }

  return (
    <div className="tab-view next-test-view">
      <header className="next-test__chrome">
        <button type="button" onClick={back} disabled={!isTieBreak && index === 0} aria-label="上一题">
          <svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7" /></svg>
        </button>
        <span>SKYLYA</span>
        <b>{isTieBreak ? `补充 ${tieIndex + 1}` : `${String(index + 1).padStart(2, '0')} / 12`}</b>
      </header>
      <div className="next-test__progress"><span style={{ width: `${progress}%` }} /></div>

      <main className="next-question" key={isTieBreak ? `tie-${tieQuestion.axis}` : index}>
        <div className="next-question__context">
          <span>{isTieBreak ? '补充判断' : '关系情境'}</span>
          <b>{contextLabel}</b>
        </div>
        <h1>{current.prompt}</h1>
        <p>{isTieBreak ? '前面两边差不多，这一题帮你做最后判断。' : '凭第一反应选更像你的一边，不用想太久。'}</p>
        <div className="next-question__scale" role="radiogroup" aria-label="选择符合程度">
          <div className="next-question__scale-labels">
            <span>{current.leftLabel}</span>
            <span>{current.rightLabel}</span>
          </div>
          <div className={`next-question__dots${isTieBreak ? ' next-question__dots--tie' : ''}`}>
            {(isTieBreak ? [ANSWERS[0], ANSWERS[5]] : ANSWERS).map((answer) => (
              <button
                type="button"
                key={answer.value}
                role="radio"
                aria-label={answer.label}
                aria-checked={selected === answer.value || (isTieBreak && selected === (answer.value < 0 ? tieQuestion.letters[0] : tieQuestion.letters[1]))}
                className={selected === answer.value || (isTieBreak && selected === (answer.value < 0 ? tieQuestion.letters[0] : tieQuestion.letters[1])) ? 'is-selected' : ''}
                onClick={() => choose(answer.value)}
              >
                <span aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="next-question__next" disabled={selected == null} onClick={next}>
          {isTieBreak || index === QUESTIONS.length - 1 ? '生成我的结果' : '下一题'} <span>→</span>
        </button>
        <button type="button" className="next-test__reset" onClick={reset}>重新开始</button>
      </main>
    </div>
  )
}
