import { describe, expect, it } from 'vitest'
import { classifySceneType, generateSceneComponent } from './scene-components.js'

const cases = [
  [
    'timeline',
    {
      id: 'scene-02',
      title: '从起源到现在',
      visual: '横向时间轴展示 1893、1975、2008 等关键年份',
      narration: '品牌不断演化。',
    },
    'timeline-rail',
  ],
  [
    'comparison',
    {
      id: 'scene-02',
      title: '两种选择的差异',
      visual: '左右分屏，对比 A/B 两种方案',
      narration: '选择来自不同信号。',
    },
    'split-compare',
  ],
  [
    'dataVisual',
    {
      id: 'scene-03',
      title: '数据解释',
      visual: '六维雷达图：甜度、酸度、碳酸感、果味',
      narration: '指标之间出现明显差异。',
    },
    'radar-graphic',
  ],
  [
    'experiment',
    {
      id: 'scene-04',
      title: '蒙眼实验',
      visual: '盲测后揭晓，表情发生反转',
      narration: '实验结果改变了选择。',
    },
    'experiment-stage',
  ],
  [
    'mechanism',
    {
      id: 'scene-05',
      title: '大脑机制',
      visual: '纹状体、前额叶和海马体依次高亮',
      narration: '大脑信号互相覆盖。',
    },
    'mechanism-diagram',
  ],
  [
    'processFlow',
    {
      id: 'scene-03',
      title: '流程如何发生',
      visual: '输入、处理、转化、结果组成完整流程图',
      narration: '过程一步步展开。',
    },
    'flow-diagram',
  ],
  [
    'finale',
    {
      id: 'scene-06',
      title: '最后记住这件事',
      visual: '总结回顾，主题符号居中放大',
      narration: '结尾留下一个清晰记忆点。',
    },
    'finale-symbol',
  ],
]

describe('Remotion scene components', () => {
  it.each(cases)('classifies %s scenes and emits visual structure', (type, scene, marker) => {
    expect(classifySceneType(scene, 1)).toBe(type)

    const component = generateSceneComponent(scene, 1)
    expect(component.component).toContain(marker)
    expect(component.component).toMatch(/className="(symbol-badge|metric-bars|timeline-node|flow-node|node|soda-can|bubble-field)/)
  })

  it('uses an opening hook for the first scene', () => {
    const scene = {
      id: 'scene-01',
      title: '一个问题打开全片',
      visual: '暗色空间里出现冲突主体和问号',
      narration: '先抛出一个悬念。',
    }

    const component = generateSceneComponent(scene, 0)
    expect(classifySceneType(scene, 0)).toBe('openingHook')
    expect(component.component).toContain('opening-hook')
    expect(component.component).toContain('symbol-badge')
    expect(component.component).toContain('bubble-field')
  })

  it('uses visualPlan scene type and hero objects instead of generic beverage fallback assets', () => {
    const scene = {
      id: 'scene-01',
      title: '武汉科技大学的钢铁基因',
      visual: '校门、实验室和高炉意象共同入场',
      narration: '从校园符号进入材料学科脉络。',
      visualPlan: {
        sceneType: 'openingHook',
        heroObjects: [
          { type: 'schoolGate', label: '校门' },
          { type: 'blastFurnace', label: '高炉' },
        ],
      },
    }

    const component = generateSceneComponent(scene, 0)
    expect(classifySceneType(scene, 0)).toBe('openingHook')
    expect(component.component).toContain('school-gate')
    expect(component.component).toContain('blast-furnace')
    expect(component.component).not.toContain('soda-can')
  })

  it('classifies closed-loop chain scenes as process flow before experiment', () => {
    const scene = {
      id: 'scene-02',
      title: '三链融合闭环',
      visual: '教育链、产业链、创新链形成闭环流程图',
      narration: '三条链路最终汇合成可循环的路径。',
    }

    const component = generateSceneComponent(scene, 1)
    expect(classifySceneType(scene, 1)).toBe('processFlow')
    expect(component.component).toContain('flow-diagram')
  })

  it('does not render the full visual description as copy', () => {
    const uniqueVisual = 'UNIQUE_VISUAL_TEXT_SHOULD_ONLY_CLASSIFY_NOT_RENDER'
    const scene = {
      id: 'scene-03',
      title: '未知主题',
      visual: uniqueVisual,
      narration: '这段旁白可以显示。',
    }

    const component = generateSceneComponent(scene, 2)
    expect(component.component).not.toContain(uniqueVisual)
    expect(component.component).not.toMatch(/\bscene\.visual\b/)
    expect(component.component).toContain('generic-visual')
    expect(component.component).toContain('node')
    expect(component.component).toContain('connector')
  })

  it('keeps the existing output shape for Step2 manifests', () => {
    const scene = {
      id: 'scene-02',
      title: '一条普通分镜',
      visual: '流程图展示变化路径',
      narration: '旁白内容。',
      duration: 6.5,
    }

    const component = generateSceneComponent(scene, 1)
    expect(component).toMatchObject({
      id: 'scene-02',
      duration: 6.5,
      props: { scene },
    })
    expect(typeof component.component).toBe('string')
    expect(component.component).toContain('function ProcessFlowScene')
  })
})
