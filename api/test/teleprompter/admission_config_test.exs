defmodule Teleprompter.AdmissionConfigTest do
  use ExUnit.Case, async: true
  alias Teleprompter.AdmissionConfig

  test "public and LAN defaults are bounded and distinct" do
    assert AdmissionConfig.from_env(false, fn _ -> nil end).max_sessions == 32
    assert AdmissionConfig.from_env(true, fn _ -> nil end).max_sessions == 16
    assert AdmissionConfig.from_env(false, fn _ -> nil end).limits[:per_peer] == 10
    assert AdmissionConfig.from_env(true, fn _ -> nil end).limits[:per_peer] == 30
  end

  test "explicit limits are validated instead of silently disabling admission" do
    assert AdmissionConfig.from_env(false, fn _ -> "2" end).max_sessions == 2

    for value <- ["", "0", "-1", "1.5", "1junk", "999999"] do
      assert_raise ArgumentError, fn -> AdmissionConfig.from_env(false, fn _ -> value end) end
    end
  end
end
