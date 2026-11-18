import assert from 'node:assert/strict';
import { test } from 'node:test';
import { containsAccountOrName, hasPasswordComplexity } from '../src/services/passwordPolicy.js';

test('requires at least three of the four Samba password character groups', () => {
  assert.equal(hasPasswordComplexity('Abcdef12'), true);
  assert.equal(hasPasswordComplexity('abcdef1!'), true);
  assert.equal(hasPasswordComplexity('ABCDEFG1!'), true);
  assert.equal(hasPasswordComplexity('Abcdef!!'), true);
  assert.equal(hasPasswordComplexity('abcdefgh'), false);
  assert.equal(hasPasswordComplexity('ABCDEFGH'), false);
  assert.equal(hasPasswordComplexity('12345678'), false);
});

test('classifies accented letters as letters rather than symbols', () => {
  assert.equal(hasPasswordComplexity('Árbol123'), true);
  assert.equal(hasPasswordComplexity('Árbolxxx'), false);
});

test('rejects passwords containing account or full-name parts of at least three characters', () => {
  assert.equal(containsAccountOrName('SafeCristobal9!', 'cristobal.seguel', 'Otra Persona'), true);
  assert.equal(containsAccountOrName('SafeSeguel9!', 'cristobal.seguel', 'Otra Persona'), true);
  assert.equal(containsAccountOrName('SafePersona9!', 'cuenta', 'Otra Persona'), true);
  assert.equal(containsAccountOrName('SecureR4!x', 'cristobal.seguel', 'Otra Persona'), false);
});