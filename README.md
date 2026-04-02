# Terminal Chat VS Code

Cliente VS Code para o Terminal Chat.

## Funcionalidades

- Criar sala
- Entrar em sala
- Ver histórico
- Enviar mensagens em tempo real
- Ver utilizadores online
- Suporte para mensagens multi-linha com `Shift + Enter`

## Como usar

1. Abre a Command Palette
2. Procura `Open Terminal Chat`
3. Introduz:
   - username
   - ação: criar ou entrar
   - código da sala
   - password
4. Carrega em **Ligar**

## Requisitos

- VS Code compatível com a versão indicada no `package.json`
- Backend do chat a correr e acessível

## Backend actual

A extensão está configurada para ligar ao servidor público do projecto.

## Notas

- `Enter` envia a mensagem
- `Shift + Enter` cria nova linha
- O botão **Ver online** mostra os utilizadores ligados à sala
