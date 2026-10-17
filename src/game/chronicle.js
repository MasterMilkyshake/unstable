// Pure discovery rules shared by the journal and tests. No browser dependencies.
import { CHRONICLE, INVESTIGATIONS, INVESTIGATION_BY_ID } from '../data/chronicle.js';

export function hasEvidence(ch, ids) {
  const read = new Set(ch.lore || []);
  return ids.every((id) => read.has(id));
}

export function unlockedChapters(ch) {
  return CHRONICLE.filter((entry) => hasEvidence(ch, entry.evidence));
}

export function investigationState(ch, investigation) {
  const read = new Set(ch.lore || []);
  const claimed = new Set(ch.investigations || []);
  const found = investigation.evidence.filter((id) => read.has(id));
  const requirements = investigation.requires || [];
  const remaining = requirements.filter((id) => !claimed.has(id));
  const complete = found.length === investigation.evidence.length && remaining.length === 0;
  return {
    found, remaining, complete,
    status: claimed.has(investigation.id) ? 'recorded' : complete ? 'ready' : found.length ? 'in_progress' : 'undiscovered',
  };
}

// Mark before granting rewards: duplicate clicks or a reload cannot claim twice.
export function recordInvestigation(ch, id) {
  const investigation = INVESTIGATION_BY_ID[id];
  if (!investigation || investigationState(ch, investigation).status !== 'ready') return null;
  ch.investigations ||= [];
  ch.investigations.push(id);
  if (investigation.titleReward) {
    ch.titles ||= [];
    if (!ch.titles.includes(investigation.titleReward)) ch.titles.push(investigation.titleReward);
  }
  return investigation;
}

export function discoveryChanges(before, after) {
  const previous = new Set(unlockedChapters(before).map((entry) => entry.id));
  return {
    chapters: unlockedChapters(after).filter((entry) => !previous.has(entry.id)),
    ready: INVESTIGATIONS.filter((entry) => investigationState(after, entry).status === 'ready' && investigationState(before, entry).status !== 'ready'),
  };
}
