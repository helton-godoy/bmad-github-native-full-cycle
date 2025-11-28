# BMAD Daily Cycle
Este workflow executa um ciclo completo de desenvolvimento de uma feature pequena seguindo o método BMAD.

1. **Contextualização:**
   Leia o arquivo de memória do projeto para entender o estado atual.
   ```bash
   read_file activeContext.md
   ```

2. **Planejamento:**
   Verifique as tarefas pendentes. Se houver uma tarefa clara, crie ou atualize o documento de arquitetura em `docs/architecture/`.

3. **Implementação:**
   Implemente o código necessário para a tarefa planejada. Lembre-se de criar testes unitários.

4. **Verificação (Gatekeeper):**
   Execute o script de segurança para validar seu trabalho.
   ```bash
   npm run bmad:gatekeeper -- "feat: daily progress"
   ```

5. **Finalização:**
   Se o gatekeeper passar com sucesso, atualize o `activeContext.md` com o progresso feito e prepare o Pull Request.
