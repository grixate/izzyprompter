defmodule Teleprompter.PromptSettings do
  @defaults %{
    "speed" => 0.56,
    "fontSize" => 64,
    "lineHeight" => 1.24,
    "textWidth" => 68,
    "mirrored" => false
  }
  def defaults, do: @defaults

  def validate(settings) when is_map(settings) do
    settings = Map.merge(@defaults, Map.take(settings, Map.keys(@defaults)))

    ranges = [
      {"speed", 0.2, 1.5},
      {"fontSize", 20, 160},
      {"lineHeight", 0.8, 3},
      {"textWidth", 25, 100}
    ]

    if is_boolean(settings["mirrored"]) and
         Enum.all?(ranges, fn {key, low, high} ->
           is_number(settings[key]) and settings[key] >= low and settings[key] <= high
         end),
       do: {:ok, Map.update!(settings, "speed", &min(&1, 1.0))},
       else: {:error, :invalid_settings}
  end

  def validate(_), do: {:error, :invalid_settings}
end
