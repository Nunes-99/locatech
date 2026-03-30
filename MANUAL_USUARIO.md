# LocaTech - Manual do Usuario

## O que e o LocaTech?

O LocaTech e um sistema completo de gestao para **locadoras de equipamentos**. Ele permite gerenciar todo o ciclo de locacao, desde o cadastro de equipamentos ate o controle financeiro, tudo em uma unica plataforma.

---

## Primeiros Passos

### 1. Acessando o Sistema

1. Abra o navegador e acesse o endereco do sistema
2. Na tela inicial, voce vera as opcoes de **Login** e **Cadastro**

### 2. Criando sua Conta

1. Clique em **"Criar conta"** ou **"Cadastro"**
2. Preencha os dados:
   - Nome completo
   - Email (sera seu login)
   - Senha (minimo 6 caracteres)
   - Nome da sua empresa/locadora
3. Clique em **"Cadastrar"**
4. Voce sera redirecionado para o Dashboard

### 3. Fazendo Login

1. Digite seu email
2. Digite sua senha
3. Clique em **"Entrar"**

---

## Navegacao Principal

Apos fazer login, voce vera o menu lateral (sidebar) com as seguintes opcoes:

| Menu | Funcao |
|------|--------|
| Dashboard | Visao geral do negocio |
| Equipamentos | Gerenciar seus equipamentos |
| Clientes | Cadastro e gestao de clientes |
| Locacoes | Criar e gerenciar locacoes |
| Calendario | Visualizar agenda de locacoes |
| Manutencoes | Controle de manutencoes |
| Financeiro | Controle financeiro |
| Relatorios | Relatorios e exportacao |
| Usuarios | Gerenciar usuarios da empresa |
| Configuracoes | Ajustes do sistema |

---

## Funcionalidades Detalhadas

### Dashboard

O Dashboard e sua pagina inicial apos o login. Aqui voce encontra:

- **Cards de Resumo**: Total de equipamentos, clientes, locacoes ativas
- **Graficos**: Visualizacao de receitas e ocupacao
- **Alertas**: Locacoes atrasadas, manutencoes pendentes
- **Ultimas Locacoes**: Lista das locacoes mais recentes

---

### Equipamentos

#### Visualizando Equipamentos
1. Clique em **"Equipamentos"** no menu
2. Voce vera uma tabela com todos os equipamentos cadastrados
3. Use a barra de busca para filtrar por nome ou codigo
4. Use os filtros para ver por categoria ou status

#### Cadastrando um Novo Equipamento
1. Clique no botao **"+ Novo Equipamento"**
2. Preencha os dados:
   - **Codigo**: Identificador unico (ex: AND-001)
   - **Nome**: Nome do equipamento
   - **Categoria**: Selecione ou crie uma categoria
   - **Marca/Modelo**: Informacoes do fabricante
   - **Valor Diaria**: Preco por dia de locacao
   - **Valor Semanal**: Preco por semana (opcional)
   - **Valor Mensal**: Preco por mes (opcional)
   - **Valor Caucao**: Deposito de seguranca (opcional)
   - **Imagem**: Foto do equipamento
3. Clique em **"Salvar"**

#### Status dos Equipamentos
- **Disponivel** (verde): Pronto para locacao
- **Locado** (azul): Em uso por um cliente
- **Manutencao** (amarelo): Em reparo
- **Reservado** (roxo): Reservado para uma locacao futura
- **Inativo** (cinza): Fora de operacao

#### Editando um Equipamento
1. Clique no equipamento desejado
2. Clique no icone de **editar** (lapis)
3. Faca as alteracoes
4. Clique em **"Salvar"**

---

### Clientes

#### Visualizando Clientes
1. Clique em **"Clientes"** no menu
2. Veja a lista de todos os clientes cadastrados
3. Use a busca para encontrar por nome, CPF ou telefone

#### Cadastrando um Novo Cliente
1. Clique em **"+ Novo Cliente"**
2. Preencha os dados:
   - **Nome Completo**
   - **CPF ou CNPJ**: O sistema valida automaticamente
   - **Telefone**: Com DDD
   - **Email**: Para envio de notificacoes
   - **Endereco**: Rua, numero, bairro, cidade, estado, CEP
3. Clique em **"Salvar"**

#### Dica: Busca de CEP
Ao digitar o CEP, o sistema preenche automaticamente o endereco!

#### Score de Credito
O sistema classifica os clientes automaticamente:
- **Excelente**: Cliente sem historico de atrasos
- **Bom**: Poucos atrasos
- **Regular**: Alguns atrasos
- **Ruim**: Muitos atrasos
- **Bloqueado**: Cliente com restricoes

---

### Locacoes

#### Criando uma Nova Locacao
1. Clique em **"Locacoes"** no menu
2. Clique em **"+ Nova Locacao"**
3. Selecione o **Cliente**
4. Escolha os **Equipamentos** disponiveis
5. Defina as datas:
   - **Data de Inicio**: Quando o cliente recebe
   - **Data Prevista de Devolucao**: Quando deve devolver
6. Escolha o tipo:
   - **Entrega**: Voce leva ate o cliente
   - **Retirada**: Cliente busca na loja
7. Revise os valores calculados automaticamente
8. Clique em **"Criar Locacao"**

#### Status das Locacoes
- **Orcamento**: Proposta ainda nao confirmada
- **Confirmada**: Locacao agendada
- **Em Andamento**: Equipamento com o cliente
- **Atrasada**: Passou da data de devolucao
- **Devolvida**: Equipamento retornado
- **Concluida**: Locacao finalizada e paga
- **Cancelada**: Locacao cancelada

#### Registrando uma Devolucao
1. Encontre a locacao na lista
2. Clique no botao **"Devolver"**
3. Verifique o estado dos equipamentos
4. Registre danos (se houver)
5. Confirme a devolucao

#### Gerando Contrato PDF
1. Abra a locacao desejada
2. Clique no botao **"Gerar Contrato"**
3. O PDF sera baixado automaticamente

---

### Calendario

O calendario mostra visualmente todas as locacoes:

- **Azul**: Entregas/Inicio de locacoes
- **Verde**: Devolucoes previstas
- **Vermelho**: Locacoes atrasadas

#### Navegando no Calendario
- Use as setas para mudar de mes/semana
- Clique em **Mes**, **Semana**, **Dia** ou **Agenda** para mudar a visualizacao
- Clique em um evento para ver detalhes

#### Reagendando uma Locacao
1. Clique e arraste o evento para a nova data
2. Confirme o reagendamento

---

### Manutencoes

#### Criando uma Manutencao
1. Clique em **"Manutencoes"** no menu
2. Clique em **"+ Nova Manutencao"**
3. Selecione o **Equipamento**
4. Escolha o tipo:
   - **Preventiva**: Manutencao programada
   - **Corretiva**: Reparo de defeito
   - **Inspecao**: Verificacao de rotina
5. Preencha:
   - **Titulo**: Descricao breve
   - **Data Agendada**
   - **Custo de Mao de Obra**
   - **Custo de Pecas**
6. Clique em **"Salvar"**

#### Status das Manutencoes
- **Agendada**: Programada para o futuro
- **Em Andamento**: Sendo realizada
- **Concluida**: Finalizada
- **Cancelada**: Nao sera realizada

---

### Financeiro

A pagina financeira mostra:

#### Resumo
- **Receita Total**: Soma de todas as locacoes pagas
- **A Receber**: Valores pendentes
- **Despesas**: Custos de manutencao

#### Graficos
- Faturamento mensal
- Comparativo de periodos
- Fluxo de caixa

#### Filtros
- Selecione o periodo desejado
- Filtre por status de pagamento

---

### Relatorios

#### Tipos de Relatorios
1. **Equipamentos**: Lista completa com status e metricas
2. **Clientes**: Historico e classificacao
3. **Locacoes**: Detalhamento de todas as locacoes
4. **Financeiro**: Receitas e despesas

#### Exportando Dados
1. Selecione o tipo de relatorio
2. Aplique os filtros desejados
3. Clique em **"Exportar CSV"** ou **"Exportar Excel"**
4. O arquivo sera baixado

---

### Usuarios

#### Niveis de Acesso
- **Proprietario (Owner)**: Acesso total, pode gerenciar usuarios
- **Administrador**: Acesso total, exceto configuracoes criticas
- **Operador**: Acesso limitado a operacoes do dia-a-dia

#### Adicionando um Usuario
1. Clique em **"Usuarios"** no menu
2. Clique em **"+ Novo Usuario"**
3. Preencha os dados:
   - Nome
   - Email
   - Senha temporaria
   - Nivel de acesso
4. Clique em **"Salvar"**
5. O usuario recebera um email para acessar

---

### Configuracoes

#### Dados da Empresa
- Nome da empresa
- CNPJ
- Telefone
- Email
- Endereco completo

#### Preferencias
- Dias padrao de locacao
- Percentual de multa por atraso
- Cores e logo da empresa

#### Alterar Senha
1. Va em **Configuracoes**
2. Clique em **"Alterar Senha"**
3. Digite a senha atual
4. Digite a nova senha (2x)
5. Clique em **"Salvar"**

---

## Planos e Limites

### Plano Gratuito
- Ate 20 equipamentos
- Ate 50 clientes
- 1 usuario
- Funcionalidades basicas

### Plano Starter (R$ 79,90/mes)
- Ate 100 equipamentos
- Ate 500 clientes
- 3 usuarios
- Notificacoes por email e WhatsApp
- Exportacao Excel

### Plano Pro (R$ 149,90/mes)
- Equipamentos ilimitados
- Clientes ilimitados
- 10 usuarios
- Todas as funcionalidades
- API de integracao
- Marca propria (logo personalizado)

#### Fazendo Upgrade
1. Clique em **"Upgrade"** no menu
2. Escolha o plano desejado
3. Clique em **"Assinar"**
4. Complete o pagamento com cartao de credito

---

## Notificacoes

O sistema envia notificacoes automaticas:

- **Email**: Confirmacoes, lembretes, alertas
- **WhatsApp** (planos pagos): Mensagens diretas para clientes
- **No Sistema**: Icone de sino no topo da tela

---

## Modo Escuro

Para ativar o modo escuro:
1. Clique no icone de sol/lua no topo da tela
2. O tema sera alternado automaticamente

---

## Aplicativo Movel (PWA)

O LocaTech funciona como aplicativo no celular:

### Instalando no Android
1. Acesse o sistema pelo Chrome
2. Toque nos 3 pontos (menu)
3. Toque em **"Adicionar a tela inicial"**
4. Confirme a instalacao

### Instalando no iPhone
1. Acesse o sistema pelo Safari
2. Toque no icone de compartilhar
3. Toque em **"Adicionar a Tela de Inicio"**
4. Confirme a instalacao

---

## Dicas e Boas Praticas

1. **Cadastre todos os equipamentos** com fotos para facilitar identificacao
2. **Mantenha os dados dos clientes atualizados**, especialmente telefone
3. **Registre todas as manutencoes** para historico do equipamento
4. **Faca backup dos relatorios** periodicamente exportando para Excel
5. **Verifique o Dashboard diariamente** para acompanhar alertas

---

## Suporte

Se precisar de ajuda:
1. Verifique este manual
2. Consulte os tooltips (icones de interrogacao) no sistema
3. Entre em contato pelo email de suporte

---

*Manual atualizado em: 02/01/2026*
*Versao do sistema: 1.0*
