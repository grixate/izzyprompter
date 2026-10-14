defmodule Mix.Tasks.Izzy.EmailCheck do
  use Mix.Task
  @shortdoc "Send a harmless SMTP delivery probe to an owner-controlled inbox"

  @impl true
  def run(args) do
    {opts, rest, invalid} = OptionParser.parse(args, strict: [to: :string])
    recipient = opts[:to] || ""

    unless rest == [] and invalid == [] and
             Regex.match?(~r/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/, recipient),
           do: Mix.raise("Use mix izzy.email_check --to an-owner-controlled-inbox")

    if Mix.env() == :test, do: Mix.raise("Run delivery checks outside automated test mode")
    if is_nil(Teleprompter.SmtpConfig.from_env()), do: Mix.raise("Configure SMTP first")

    Mix.Task.run("app.start")

    unless Application.fetch_env!(:teleprompter, Teleprompter.Mailer)[:adapter] ==
             Swoosh.Adapters.SMTP,
           do: Mix.raise("Delivery check requires the SMTP adapter")

    email =
      Swoosh.Email.new()
      |> Swoosh.Email.to(recipient)
      |> Swoosh.Email.from({"IZZY", Application.fetch_env!(:teleprompter, :mail_from)})
      |> Swoosh.Email.subject("IZZY email delivery check")
      |> Swoosh.Email.text_body(
        "This is the requested IZZY transactional email delivery check.\n\n" <>
          "It contains no login link and grants no account access.\n" <>
          "Please check the sender, spam folder, and SPF/DKIM/DMARC authentication results."
      )

    case Teleprompter.Mailer.deliver(email) do
      {:ok, _} ->
        Mix.shell().info(
          "SMTP accepted the delivery check. Inbox receipt still needs confirmation."
        )

      {:error, _} ->
        Mix.raise("SMTP delivery failed. Check Postbox verification, quota and key permissions.")
    end
  end
end
