import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { calculateAvgScore, getPredikat, enrichGradeStats } from '../src/utils/gradeUtils.js'

describe('gradeUtils', () => {
  it('correctly calculates average when 0 is given as a valid score', () => {
    // 0 is a valid score, not omitted!
    // (0 + 60 + 60) / 3 = 40
    assert.equal(calculateAvgScore(0, 60, 60), 40)
    // 0 alone: 0 / 1 = 0
    assert.equal(calculateAvgScore(0, null, null), 0)
    // (0 + 100) / 2 = 50
    assert.equal(calculateAvgScore(0, 100, null), 50)
  })

  it('omits null, undefined, and empty string from average calculation', () => {
    assert.equal(calculateAvgScore(80, null, 90), 85)
    assert.equal(calculateAvgScore(75, undefined, undefined), 75)
    assert.equal(calculateAvgScore(null, null, null), 0)
    assert.equal(calculateAvgScore('', null, undefined), 0)
    assert.equal(calculateAvgScore(80, '', 90), 85)
  })

  it('correctly maps predikat based on 0-100 range', () => {
    assert.equal(getPredikat(100), 'A')
    assert.equal(getPredikat(90), 'A')
    assert.equal(getPredikat(89), 'B')
    assert.equal(getPredikat(75), 'B')
    assert.equal(getPredikat(74), 'C')
    assert.equal(getPredikat(60), 'C')
    assert.equal(getPredikat(59), 'D')
    assert.equal(getPredikat(0), 'D')
  })

  it('enriches grade stats properly', () => {
    const grade = { attitude_score: 95, skill_score: 85, activity_score: 90 }
    const stats = enrichGradeStats(grade)
    assert.equal(stats.avg, 90)
    assert.equal(stats.predikat, 'A')
  })
})
