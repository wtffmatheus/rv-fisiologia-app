import copy
import json
import pathlib
import plistlib
import re
import sys
import uuid

ROOT = pathlib.Path(__file__).resolve().parent
BASE = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / 'output/validation/current.shortcut'
original = plistlib.loads(BASE.read_bytes())
actions = []
ENDPOINT = 'https://ilnlnkcxajkarwviynbm.supabase.co/functions/v1/health-ingest'


def add(identifier, **parameters):
    action_id = str(uuid.uuid4()).upper()
    parameters['UUID'] = action_id
    actions.append({'WFWorkflowActionIdentifier': 'is.workflow.actions.' + identifier, 'WFWorkflowActionParameters': parameters})
    return action_id


def output(action_id, name='Result'):
    return {'Value': {'OutputUUID': action_id, 'Type': 'ActionOutput', 'OutputName': name}, 'WFSerializationType': 'WFTextTokenAttachment'}


def variable(name):
    return {'Value': {'VariableName': name, 'Type': 'Variable'}, 'WFSerializationType': 'WFTextTokenAttachment'}


def text_value(value):
    if isinstance(value, dict):
        return {'Value': {'string': '\ufffc', 'attachmentsByRange': {'{0, 1}': value['Value']}}, 'WFSerializationType': 'WFTextTokenString'}
    return {'Value': {'string': str(value)}, 'WFSerializationType': 'WFTextTokenString'}


def dictionary(fields):
    items = []
    for key, value, kind in fields:
        items.append({'WFKey': text_value(key), 'WFItemType': kind, 'WFValue': value if kind == 2 else text_value(value)})
    return {'Value': {'WFDictionaryFieldValueItems': items}, 'WFSerializationType': 'WFDictionaryFieldValue'}


def set_text(name, value):
    result = add('gettext', WFTextActionText=value)
    add('setvariable', WFVariableName=name, WFInput=output(result))


def condition(value, expected=None):
    group = str(uuid.uuid4()).upper()
    params = {'WFInput': {'Type': 'Variable', 'Variable': value}, 'WFCondition': 100 if expected is None else 4, 'WFControlFlowMode': 0, 'GroupingIdentifier': group}
    if expected is not None:
        params['WFConditionalActionString'] = expected
    add('conditional', **params)
    return group


def otherwise(group):
    add('conditional', WFControlFlowMode=1, GroupingIdentifier=group)


def end(group):
    add('conditional', WFControlFlowMode=2, GroupingIdentifier=group)


def fail(message):
    add('alert', WFAlertActionTitle='RV — atenção', WFAlertActionMessage=message, WFAlertActionCancelButtonShown=False)
    add('exit')


def iso_now():
    current = add('date', WFDateActionMode='Current Date')
    return add('format.date', WFDate=output(current), WFDateFormatStyle='ISO 8601', WFISO8601IncludeTime=True, WFTimeFormatStyle='None')


def save_state(value):
    result = add('gettext', WFTextActionText=text_value(value) if isinstance(value, dict) else value)
    add('documentpicker.save', WFInput=output(result), WFAskWhereToSave=False, WFSaveFileOverwrite=True, WFFileDestinationPath='RV-Workout-State.txt')


def post(fields):
    response = add('downloadurl', WFURL=ENDPOINT, WFHTTPMethod='POST', WFHTTPBodyType='JSON', ShowHeaders=False,
                   WFHTTPHeaders=dictionary([('X-RV-Health-Key', variable('RV Health Key'), 0)]), WFJSONValues=dictionary(fields))
    success = add('getvalueforkey', WFInput=output(response), WFDictionaryKey='ok', WFGetDictionaryValueType='Value')
    group = str(uuid.uuid4()).upper()
    add('conditional', WFInput={'Type': 'Variable', 'Variable': output(success)}, WFCondition=4, WFNumberValue=1, WFControlFlowMode=0, GroupingIdentifier=group)
    otherwise(group)
    fail('O RV não confirmou o envio. Não considere concluído. Verifique a internet e o código; tente novamente. Se aparecer 401, gere outro código no RV e reconfigure este atalho.')
    end(group)


def event(metric):
    moment = iso_now()
    identity = add('gettext', WFTextActionText={'Value': {'string': metric + '|\ufffc', 'attachmentsByRange': {f'{{{len(metric) + 1}, 1}}': variable('RV Session')['Value']}}, 'WFSerializationType': 'WFTextTokenString'})
    post([('source', 'apple_health', 0), ('metric', metric, 0), ('value', 0, 3), ('unit', 'event', 0),
          ('measured_at', output(moment), 0), ('source_id', output(identity), 0), ('workout_type', 'workout', 0)])


add('comment', WFCommentActionText='RV Saúde — CANDIDATO V1. Não validado no iPhone. Configuração única, sem clipboard. analysis/start/sync/end; sem entrada, mostra menu. Não substitua suas automações antes dos testes.')
key_index = len(actions)
key = add('gettext', WFTextActionText='COLE_O_CODIGO_DO_RV')
add('setvariable', WFVariableName='RV Health Key', WFInput=output(key))
missing = condition(variable('RV Health Key'), 'COLE_O_CODIGO_DO_RV')
fail('Configure uma vez o código de conexão do RV na primeira ação Texto. Não compartilhe o atalho depois de colocar seu código.')
end(missing)

incoming = add('detect.text', WFInput={'Value': {'Type': 'ExtensionInput'}, 'WFSerializationType': 'WFTextTokenAttachment'})
has_input = condition(output(incoming))
add('setvariable', WFVariableName='RV Mode', WFInput=output(incoming))
otherwise(has_input)
menu = str(uuid.uuid4()).upper()
choices = {'Analisar dados recentes': 'analysis', 'Iniciar treino RV': 'start', 'Sincronizar treino': 'sync', 'Finalizar treino RV': 'end'}
add('choosefrommenu', WFMenuPrompt='RV Saúde', WFMenuItems=list(choices), WFControlFlowMode=0, GroupingIdentifier=menu)
for title, mode in choices.items():
    add('choosefrommenu', WFMenuItemTitle=title, WFControlFlowMode=1, GroupingIdentifier=menu)
    set_text('RV Mode', mode)
add('choosefrommenu', WFControlFlowMode=2, GroupingIdentifier=menu)
end(has_input)

set_text('RV Valid Mode', 'no')
for mode in choices.values():
    branch = condition(variable('RV Mode'), mode)
    set_text('RV Valid Mode', 'yes')
    end(branch)
invalid = condition(variable('RV Valid Mode'), 'no')
fail('Entrada inválida. Use apenas analysis, start, sync ou end em minúsculas, ou execute sem entrada para abrir o menu.')
end(invalid)

analysis = condition(variable('RV Mode'), 'analysis')
otherwise(analysis)
state_file = add('documentpicker.open', WFGetFilePath='RV-Workout-State.txt', WFFileErrorIfNotFound=False, WFShowFilePicker=False)
state = add('detect.text', WFInput=output(state_file))
add('setvariable', WFVariableName='RV Session', WFInput=output(state))
end(analysis)

starting = condition(variable('RV Mode'), 'start')
existing = condition(variable('RV Session'))
closed = condition(variable('RV Session'), 'closed')
moment = iso_now()
add('setvariable', WFVariableName='RV Session', WFInput=output(moment))
end(closed)
otherwise(existing)
moment = iso_now()
add('setvariable', WFVariableName='RV Session', WFInput=output(moment))
end(existing)
save_state(variable('RV Session'))
event('workout_start')
add('exit')
end(starting)

analysis = condition(variable('RV Mode'), 'analysis')
otherwise(analysis)
has_session = condition(variable('RV Session'))
closed = condition(variable('RV Session'), 'closed')
fail('Nenhum treino RV aberto neste iPhone. Inicie o treino RV antes de sincronizar ou finalizar.')
end(closed)
otherwise(has_session)
fail('Nenhum treino RV aberto neste iPhone. Inicie o treino RV antes de sincronizar ou finalizar.')
end(has_session)
end(analysis)

set_text('RV Days', '1')
analysis = condition(variable('RV Mode'), 'analysis')
set_text('RV Days', '7')
end(analysis)

for block_start in (23, 32, 41, 50, 59):
    template = copy.deepcopy(original['WFWorkflowActions'][block_start]['WFWorkflowActionParameters'])
    template.pop('UUID', None)
    date_filter = template['WFContentItemFilter']['Value']['WFActionParameterFilterTemplates'][1]
    date_filter['Values']['Number'] = text_value(variable('RV Days'))
    template.update(WFContentItemLimitEnabled=True, WFContentItemLimitNumber=500,
                    WFContentItemSortProperty='Start Date', WFContentItemSortOrder='Latest First')
    find = add('filter.health.quantity', **template)
    nonempty = condition(output(find))
    repeat_group = str(uuid.uuid4()).upper()
    add('repeat.each', WFInput=output(find), WFControlFlowMode=0, GroupingIdentifier=repeat_group)
    value = add('properties.health.quantity', WFInput=variable('Repeat Item'), WFContentItemPropertyName='Value')
    number = add('math', WFInput=output(value), WFMathOperation='+', WFMathOperand=0)
    unit = add('properties.health.quantity', WFInput=variable('Repeat Item'), WFContentItemPropertyName='Unit')
    date = add('properties.health.quantity', WFInput=variable('Repeat Item'), WFContentItemPropertyName='Start Date')
    formatted = add('format.date', WFDate=output(date), WFDateFormatStyle='ISO 8601', WFISO8601IncludeTime=True, WFTimeFormatStyle='None')
    old_fields = original['WFWorkflowActions'][block_start + 6]['WFWorkflowActionParameters']['WFJSONValues']['Value']['WFDictionaryFieldValueItems']
    metric = next(item['WFValue']['Value']['string'] for item in old_fields if item['WFKey']['Value']['string'] == 'metric')
    add('dictionary', WFItems=dictionary([('source', 'apple_health', 0), ('metric', metric, 0), ('value', output(number), 3), ('unit', output(unit), 0), ('measured_at', output(formatted), 0)]))
    repeated = add('repeat.each', WFControlFlowMode=2, GroupingIdentifier=repeat_group)
    post([('source', 'apple_health', 0), ('samples', output(repeated, 'Repeat Results'), 2)])
    end(nonempty)

ending = condition(variable('RV Mode'), 'end')
event('workout_end')
save_state('closed')
end(ending)

workflow = {key: copy.deepcopy(value) for key, value in original.items() if key != 'WFWorkflowActions'}
workflow.update(WFWorkflowName='RV Saúde', WFWorkflowActions=actions,
                WFWorkflowHasShortcutInputVariables=True, WFWorkflowInputContentItemClasses=['WFStringContentItem'],
                WFWorkflowImportQuestions=[{'Category': 'Parameter', 'ActionIndex': key_index, 'ParameterKey': 'WFTextActionText', 'Text': 'Cole o código criado em RV App → Apple Watch → Criar código', 'DefaultValue': ''}])
destination = ROOT / 'RV-Saude-v1-NAO-ASSINADO.shortcut'
destination.write_bytes(plistlib.dumps(workflow, fmt=plistlib.FMT_XML, sort_keys=False))
encoded = destination.read_text('utf8')
assert not re.search(r'rvh_[a-f0-9]{48}', encoded)
ids = [action['WFWorkflowActionParameters']['UUID'] for action in actions]
assert len(ids) == len(set(ids))
assert 'is.workflow.actions.getclipboard' not in encoded
stack = []
for action in actions:
    params = action['WFWorkflowActionParameters']
    mode = params.get('WFControlFlowMode')
    if mode == 0:
        stack.append(params['GroupingIdentifier'])
    elif mode in (1, 2):
        assert stack and stack[-1] == params['GroupingIdentifier']
        if mode == 2:
            stack.pop()
assert not stack
references = re.findall(r'<key>OutputUUID</key>\s*<string>([^<]+)</string>', encoded)
assert all(reference in ids for reference in references)
print(json.dumps({'file': str(destination), 'actions': len(actions), 'checks': ['plist roundtrip', 'unique UUIDs', 'balanced branches', 'output references', 'no embedded key', 'no clipboard'], 'signed': False, 'device_validated': False}, ensure_ascii=True))
