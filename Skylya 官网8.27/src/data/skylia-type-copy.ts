/**
 * 八种 Skylya Type 的展示文案（与旧版 newSkyLiaUi v6 `SkyliaType.tsx` 中 TYPE_DEFS 对齐）。
 * 英文副标题为新版详情页布局补充，v6 仅有中文 name / description。
 */

export type SkyliaTypeCode = 'LAS' | 'LAD' | 'LBS' | 'LBD' | 'CAS' | 'CAD' | 'CBS' | 'CBD'

export interface SkyliaTypeCopy {
  code: SkyliaTypeCode
  /** 中文短标题（原 v6 `name`） */
  name: string
  /** 英文副标题：单行短句，交由容器自然折行（text-wrap:pretty），不含硬换行 */
  enTagline: string
  description: string
  traits: [string, string, string, string]
  strengths: string[]
  challenges: string[]
  bestMatches: SkyliaTypeCode[]
  watchPairs: SkyliaTypeCode[]
  growthTips: string[]
}

export const SKYLIA_TYPE_COPY: Record<SkyliaTypeCode, SkyliaTypeCopy> = {
  LAS: {
    code: 'LAS',
    name: '让关系稳下来的人',
    enTagline: 'A relaxed presence that quietly sets the pace.',
    description:
      '在关系里，从容生活家有一种让人安心的松弛。他们习惯把节奏悄悄安排妥当，很少让生活失序；这份笃定的背后，是对所爱之人细致的照拂。和他们在一起，日子会被稳稳地托着，从容本身就是一种温柔。',
    traits: ['让人安心', '会安排节奏', '不喜欢混乱', '表达很克制'],
    strengths: [
      '很会把关系安排得稳稳当当，让人有安全感',
      '遇到矛盾时比较冷静，能先想办法解决问题',
      '会留意伴侣需要什么，也愿意提前做好安排',
      '适合长期相处，给人的感觉可靠、踏实',
    ],
    challenges: [
      '有时会安排太多，让对方觉得空间不够',
      '事情一乱，容易变得紧绷',
      '一旦决定离开，通常很难再回头',
    ],
    bestMatches: ['CAD', 'CBS', 'CBD'],
    watchPairs: ['LAD', 'LBD'],
    growthTips: [
      '试着少安排一点，给对方更多自己决定的空间',
      '累的时候直接说出来，不必什么都自己扛',
      '决定离开前，先给彼此一次好好修复的机会',
      '接受一点不确定，不是所有事都必须马上掌控',
    ],
  },
  LAD: {
    code: 'LAD',
    name: '主动把关系往前推的人',
    enTagline: 'Charisma that moves things forward.',
    description:
      '热忱行动家自带一股向前的热度。他们行动果断、富有感染力，愿意主动把关系往前推，让心动尽快变成真实发生的事。他们带来的活力，常常让平淡的日子重新亮起来。',
    traits: ['行动很快', '敢做决定', '很有吸引力', '存在感强'],
    strengths: [
      '喜欢就会行动，能让关系很快有进展',
      '表达直接、有感染力，容易吸引别人',
      '能给相处带来热度和新鲜感',
      '遇到问题通常会直接面对，不太逃避',
    ],
    challenges: [
      '有时太快太强，容易盖过对方的声音',
      '太喜欢变化时，对方可能会觉得不够稳定',
      '争执时容易坚持自己的想法',
    ],
    bestMatches: ['CAS', 'CBS', 'CBD'],
    watchPairs: ['LAS', 'LBD'],
    growthTips: [
      '多听听对方怎么想，别急着替两个人决定',
      '关系推进时，记得邀请对方一起参与',
      '往前走之前，先看看对方的节奏跟不跟得上',
      '给关系一点耐心，不是每件事都要马上有答案',
    ],
  },
  LBS: {
    code: 'LBS',
    name: '遇事会先稳住的人',
    enTagline: 'Keeping the whole scene from spinning out.',
    description:
      '专注思考者成熟而可靠，是关系里让人踏实的那一个。情绪过热时，他们会先稳住局面，把风险想在前面。这份沉静不是疏离，而是他们守护一段关系的方式。',
    traits: ['成熟可靠', '会提前想问题', '能让情绪降下来', '稳定内敛'],
    strengths: [
      '很会提前想到问题，尽量避免关系走偏',
      '成熟稳重，容易让伴侣觉得安心',
      '情绪激动时，能把场面慢慢稳下来',
      '长期相处里可靠，也愿意负责任',
    ],
    challenges: [
      '太怕出问题时，关系会少一点轻松和活力',
      '总是降温，可能会让对方觉得情绪不被接住',
      '一旦决定退出，通常很难被挽回',
    ],
    bestMatches: ['CAS', 'CAD', 'CBD'],
    watchPairs: ['LAD', 'CBS'],
    growthTips: [
      '允许关系有一点不确定和起伏',
      '对方有情绪时，先听完，不急着降温',
      '发现自己想控制局面时，试着多留一点空间',
      '想离开之前，给自己和关系多一点时间',
    ],
  },
  LBD: {
    code: 'LBD',
    name: '一步步把关系落地的人',
    enTagline: 'Quiet resolve, steady decisions.',
    description:
      '好奇旅行者目标清晰、脚步笃定。他们不太被一时的情绪带着走，而是用持续而稳定的投入，把关系一点点走成具体的模样。对他们而言，踏实地抵达，就是最动人的浪漫。',
    traits: ['知道自己要什么', '做事踏实', '不太被情绪带跑', '看重现实'],
    strengths: [
      '知道关系要往哪走，也愿意一步步推进',
      '投入比较稳定，不会太受一时情绪影响',
      '会考虑现实条件，做决定比较清醒',
    ],
    challenges: [
      '推进太紧时，对方可能会有压力',
      '太看重结果时，容易忽略相处过程里的感受',
      '一旦不想继续，抽身会很快，让对方措手不及',
    ],
    bestMatches: ['CAS', 'CAD', 'CBS'],
    watchPairs: ['LAS', 'LAD'],
    growthTips: [
      '除了推进结果，也多说说自己的感受',
      '给对方一点喘息空间，不要一直往前推',
      '除了实际问题，也照顾一下彼此的情绪需求',
      '想抽身之前，先看看关系还有没有修复空间',
    ],
  },
  CAS: {
    code: 'CAS',
    name: '让相处变轻松的人',
    enTagline: 'Adaptable, soft, and steady.',
    description:
      '温柔连接者适应力极强，是关系里天然的缓冲。他们包容、可靠，愿意顺应彼此的节奏，让相处变得轻松而安心。真正的温柔，是让对方在自己身边可以彻底放松下来。',
    traits: ['很会配合', '温和包容', '说到做到', '稳定可靠'],
    strengths: [
      '很会配合对方的节奏，相处起来不费力',
      '温和包容，容易让伴侣放松下来',
      '说好的事会认真去做，能把计划落到生活里',
      '长期相处里稳定可靠，是很踏实的陪伴',
    ],
    challenges: [
      '太配合别人时，容易忽略自己的需要',
      '太随和时，对方可能误以为你没有立场',
      '长期忍着不说，最后可能会突然爆发',
    ],
    bestMatches: ['LAD', 'LBS', 'LBD'],
    watchPairs: ['CBS', 'CAD'],
    growthTips: [
      '练习说出自己的需要和立场，不只是配合',
      '发现自己一直迁就时，记得给自己设边界',
      '可以主动提出想法，不必总等对方安排',
      '经常问问自己真实感受，别一直压在心里',
    ],
  },
  CAD: {
    code: 'CAD',
    name: '跟着感觉靠近的人',
    enTagline: 'Light on its feet, alive in the moment.',
    description:
      '探索表达者轻盈而灵动，更信任当下真实的感受。他们靠近不需要太多铺垫，那份即时的鲜活本身就很有吸引力。和他们在一起，关系很少沉闷，总有新的风景在前面。',
    traits: ['轻松自在', '跟着感觉走', '不急着定结果', '好相处'],
    strengths: [
      '轻松自在，给关系带来活力和新鲜感',
      '不太被结果绑住，能享受当下的感觉',
      '容易相处，没有沉重的包袱',
      '冲突中能够快速调整，不纠结过去',
    ],
    challenges: [
      '不急着承诺时，对方可能会觉得不安',
      '进入得快、离开也快，会让关系显得不够稳定',
      '不喜欢计划太多时，对方可能不知道关系往哪走',
    ],
    bestMatches: ['LAS', 'LBS', 'LBD'],
    watchPairs: ['LAD', 'CAS'],
    growthTips: [
      '除了享受当下，也给关系一点更长期的承诺',
      '看见对方对稳定的需要，适当放慢或说明自己的节奏',
      '轻松之外，也可以多聊聊更深的想法',
      '想离开前，给关系和自己多一点思考时间',
    ],
  },
  CBS: {
    code: 'CBS',
    name: '想清楚才投入的人',
    enTagline: 'Watching, choosing, staying sure.',
    description:
      '务实行动派很少站在舞台中央，却总在把关系稳稳地向前推。他们观察细致、行动可靠，重要的事从不含糊。一旦认定，投入便安静、稳定而持续。',
    traits: ['低调但有主见', '克制内敛', '想清楚再决定', '稳定投入'],
    strengths: [
      '观察细致，通常会想清楚再做决定',
      '稳定可靠，能给伴侣长期的安全感',
      '情绪比较稳，不容易突然失控',
      '一旦承诺，投入稳定而持续',
    ],
    challenges: [
      '观察太多时，对方可能会觉得自己被审视',
      '太克制情绪时，关系可能少一点温度',
      '问题拖着不说，容易越积越多',
    ],
    bestMatches: ['LAS', 'LAD', 'LBD'],
    watchPairs: ['LBS', 'CAS'],
    growthTips: [
      '多表达自己的感受，不只是默默观察',
      '有矛盾时早点说，不要一直拖着',
      '发现自己想暗中掌控时，给对方更多空间',
      '主动说出承诺，让对方感受到你的投入',
    ],
  },
  CBD: {
    code: 'CBD',
    name: '会把关系走长远的人',
    enTagline: 'Sustainability as a relationship strategy.',
    description:
      '冷静探险家擅长让关系走得长远。稳定对他们而言是一种主动的选择——他们懂得为彼此留出舒服的距离，也擅长在关系起伏时修复与守护。慢下来，是为了走得更远。',
    traits: ['想得比较周全', '会提前想问题', '擅长维持关系', '需要一点距离'],
    strengths: [
      '很会提前想到问题，让关系走得更长久',
      '想事情比较周全，做决定不容易冲动',
      '擅长修复和维护关系，让相处保持稳定',
    ],
    challenges: [
      '太怕出问题时，关系可能不够深入',
      '总是保持距离，伴侣可能会觉得不够亲近',
      '不太主动推进时，关系可能停在原地',
    ],
    bestMatches: ['LAS', 'LAD', 'LBS'],
    watchPairs: ['CAD', 'LBD'],
    growthTips: [
      '有些关系需要一点冒险，不必总是先退一步',
      '如果距离太远，可以主动靠近一点',
      '除了维持现状，也试着推动关系往前走',
      '多表达感受，不只是把事情想明白',
    ],
  },
}

export function getSkyliaTypeCopy(code: string | undefined | null): SkyliaTypeCopy {
  const key = (code || '').trim().toUpperCase()
  if (key in SKYLIA_TYPE_COPY) return SKYLIA_TYPE_COPY[key as SkyliaTypeCode]
  return SKYLIA_TYPE_COPY.LAS
}

/** 「情感优势」tab：strengths，保证 4 条 */
export function tabAdvantageBullets(def: SkyliaTypeCopy): string[] {
  return padToFour(def.strengths, [])
}

/**
 * 「成长空间」tab：与 v6「成长空间」区块一致，仅 challenges；不足 4 条时用中性补句。
 */
export function tabGrowthBullets(def: SkyliaTypeCopy): string[] {
  return padToFour(def.challenges, [])
}

/** 「最佳配对」tab：由 bestMatches / watchPairs 生成 4 条说明 */
export function tabMatchBullets(def: SkyliaTypeCopy): string[] {
  const label = (c: SkyliaTypeCode) => {
    const d = SKYLIA_TYPE_COPY[c]
    return d ? `${c}（${d.name}）` : c
  }
  const best = def.bestMatches.map(label).join('，')
  const watch = def.watchPairs.map(label).join('，')
  return [
    `较适合的配对：${best}。`,
    '这些类型通常比较容易和你配合：有人补上你的节奏，有人接住你的需要。',
    `需要多留意的组合：${watch}；相处时建议更清晰地说出边界与期待。`,
    '这只是参考，真正合不合适，还是要看现实里的相处。',
  ]
}

const BULLET_PAD_FALLBACK = '在不同关系阶段，这一点可能会有不同表现。'

function padToFour(primary: string[], extra: string[]): string[] {
  const out = [...primary]
  let i = 0
  while (out.length < 4 && i < extra.length) {
    out.push(extra[i])
    i += 1
  }
  while (out.length < 4) out.push(BULLET_PAD_FALLBACK)
  return out.slice(0, 4)
}
