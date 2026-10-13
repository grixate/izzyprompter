defmodule Mix.Tasks.Izzy.PreviewLogin do
  use Mix.Task
  @shortdoc "Open a local-only demo login, optionally with synthetic Pro access"

  @impl true
  def run(args) do
    {opts, rest, invalid} =
      OptionParser.parse(args,
        strict: [email: :string, open: :boolean, pro: :boolean, free: :boolean]
      )

    unless rest == [] and invalid == [] and not (opts[:pro] == true and opts[:free] == true),
      do: Mix.raise("Use --email EMAIL --open [--pro | --free]")

    database = URI.parse(System.get_env("DATABASE_URL", ""))
    origin = URI.parse(System.get_env("PUBLIC_ORIGIN", ""))
    Teleprompter.PublicOrigin.parse!(System.get_env("PUBLIC_ORIGIN"), :lan)

    unless Mix.env() == :dev and database.host in ["localhost", "127.0.0.1", "::1"] and
             origin.scheme == "http" and is_binary(origin.host) and
             System.get_env("IZZY_PAYMENTS_ENABLED") != "true" and
             is_nil(System.get_env("SMTP_HOST")),
           do:
             Mix.raise(
               "Preview login requires dev mode, a loopback database, HTTP PUBLIC_ORIGIN, local mail and disabled payments. Never use a production database."
             )

    Mix.Task.run("app.start")
    alias Teleprompter.{Accounts, Repo, Commerce}
    alias Teleprompter.Commerce.{Intent, Attempt, Grant}
    import Ecto.Query
    email = opts[:email] || "preview@izzy.example"

    unless Regex.match?(~r/^[a-zA-Z0-9._+-]+@izzy\.example$/, email),
      do: Mix.raise("Use a reserved demo address ending in @izzy.example, not a real account.")

    user = Repo.get_by(Accounts.User, email: email) || Repo.insert!(%Accounts.User{email: email})

    if opts[:pro] || opts[:free] do
      Repo.transaction(fn ->
        Repo.one!(from(u in Accounts.User, where: u.id == ^user.id, lock: "FOR UPDATE"))

        if opts[:pro] do
          intent =
            Repo.get_by(Intent, user_id: user.id) || Repo.insert!(%Intent{user_id: user.id})

          attempt =
            Repo.get_by(Attempt, intent_id: intent.id, provider: "local_preview") ||
              Repo.insert!(%Attempt{
                intent_id: intent.id,
                provider: "local_preview",
                environment: "preview",
                currency: "USD",
                amount_minor: 2900,
                status: "paid"
              })

          case Repo.get_by(Grant, attempt_id: attempt.id) do
            nil -> Repo.insert!(%Grant{user_id: user.id, attempt_id: attempt.id})
            grant -> Repo.update!(Ecto.Changeset.change(grant, status: "active"))
          end
        else
          ids =
            from(a in Attempt,
              where: a.provider == "local_preview" and a.environment == "preview",
              select: a.id
            )

          Repo.update_all(
            from(g in Grant, where: g.user_id == ^user.id and g.attempt_id in subquery(ids)),
            set: [status: "revoked"]
          )
        end
      end)
    end

    Accounts.notify(user.id, %{type: "purchase_changed"})

    if opts[:open] do
      url =
        Accounts.origin() <>
          "/account/login#token=" <> Accounts.issue_token(user.id, "login", 900)

      opener = if :os.type() == {:unix, :darwin}, do: "/usr/bin/open", else: "xdg-open"

      case System.cmd(opener, [url], stderr_to_stdout: true) do
        {_, 0} ->
          Mix.shell().info(
            "Opened a one-time demo sign-in in your default browser (15-minute expiry)."
          )

        _ ->
          Mix.raise(
            "Browser could not open. No login token was printed or logged; try again with a working browser opener."
          )
      end
    else
      Mix.shell().info(
        "Demo account prepared. Add --open to sign in without sending a real email."
      )
    end

    Mix.shell().info(
      if Commerce.pro?(user),
        do: "Local demo: Pro (synthetic, no payment).",
        else: "Local demo: Free."
    )
  end
end
