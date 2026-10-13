defmodule TeleprompterWeb.AppAssets do
  @moduledoc false

  def index_path, do: Application.app_dir(:teleprompter, "priv/static/app/index.html")
  def available?(path \\ index_path()), do: File.regular?(path)
end
