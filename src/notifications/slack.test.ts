import {describe,it,expect} from 'vitest';
import {buildSlackMessage,shouldNotify} from './slack';
import type {VotingSummary} from '../personas/persona.interface';
const summary:VotingSummary={totalVoters:1,approvals:1,rejections:0,conditionals:0,errored:0,validVoters:1,undetermined:false,passed:true,requiredApprovals:1};
describe('Slack output',()=>{
  it('supports English output',()=>{
    const text=JSON.stringify(buildSlackMessage('PR','https://github.com/a/b/pull/1',1,[],summary,undefined,'en'));
    expect(text).toContain('MAGI review results');
    expect(text).toContain('Approved');
  });
  it('does not classify an incomplete result as a rejection notification',()=>{
    expect(shouldNotify({...summary,passed:false,undetermined:true,incomplete:true},'rejection')).toBe(false);
  });
});
