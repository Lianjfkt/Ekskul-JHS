import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

/**
 * Logic unit tests for CoachGrades input handling & serialization
 */
describe('CoachGrades score logic', () => {
  // Simulates handleScoreChange validation
  function validateScoreInput(value) {
    if (value === '') return true
    if (!/^\d+$/.test(value)) return false
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 0 || num > 100) return false
    return true
  }

  // Simulates handleSaveGrades parsing
  function parseScoreForSave(scoreStr) {
    return scoreStr !== '' && scoreStr !== null && scoreStr !== undefined
      ? parseInt(scoreStr, 10)
      : null
  }

  it('allows valid scores between 0 and 100 including 0', () => {
    assert.equal(validateScoreInput('0'), true)
    assert.equal(validateScoreInput('50'), true)
    assert.equal(validateScoreInput('100'), true)
    assert.equal(validateScoreInput(''), true)
  })

  it('rejects invalid scores outside 0-100 and non-digits', () => {
    assert.equal(validateScoreInput('-1'), false)
    assert.equal(validateScoreInput('101'), false)
    assert.equal(validateScoreInput('abc'), false)
    assert.equal(validateScoreInput('50a'), false)
    assert.equal(validateScoreInput(' '), false)
    assert.equal(validateScoreInput('-0'), false)
  })

  it('correctly serializes "0" as 0 (not null) and empty as null', () => {
    assert.strictEqual(parseScoreForSave('0'), 0)
    assert.strictEqual(parseScoreForSave('100'), 100)
    assert.strictEqual(parseScoreForSave('75'), 75)
    assert.strictEqual(parseScoreForSave(''), null)
    assert.strictEqual(parseScoreForSave(null), null)
    assert.strictEqual(parseScoreForSave(undefined), null)
  })

  it('quick assist format converts attendance percentage to string score', () => {
    const attendancePercentage = 85
    const activityScore = attendancePercentage.toString()
    assert.strictEqual(activityScore, '85')
    assert.equal(validateScoreInput(activityScore), true)
    assert.strictEqual(parseScoreForSave(activityScore), 85)
  })
})
