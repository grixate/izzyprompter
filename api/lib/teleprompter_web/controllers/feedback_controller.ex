defmodule TeleprompterWeb.FeedbackController do
  use TeleprompterWeb, :controller
  import TeleprompterWeb.AccountAuth, only: [require_user: 2]
  plug :require_user
  plug TeleprompterWeb.AccountWriteBudget

  def create(conn, params) do
    result =
      if Application.get_env(:teleprompter, :feedback_enabled, false),
        do: Teleprompter.Feedback.submit(conn.assigns.current_user, params),
        else: {:error, :feedback_unavailable}

    case result do
      {:ok, result} -> json(conn, result)
      {:error, reason} -> TeleprompterWeb.AccountController.error(conn, reason)
    end
  end
end
