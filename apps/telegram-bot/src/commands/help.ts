import type { Context } from "telegraf";

export function registerHelp(bot: import("telegraf").Telegraf) {
  bot.command("help", async (ctx: Context) => {
    await ctx.reply(
      [
        "Comandos WCreation:",
        "/start <token> — vincular este chat",
        "/status — listar dispositivos",
        "/status_<serial> — detalle y mini gráfico 6 h",
        "/alerts on|off — pausar o activar alertas",
        "/verify <serial> — verificar cadena de hashes",
        "/help — esta ayuda",
      ].join("\n"),
    );
  });
}
