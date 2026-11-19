import sys
import urllib.parse
import webbrowser
import pandas as pd


def build_search_query(row):
    """Constructs a clean Google search query from available row fields."""
    # Check common column names in order of usefulness
    candidate_cols = [
        "facility_name",
        "facility name",
        "name",
        "address",
        "city",
        "state",
        "zip",
    ]
    parts = []
    for col in candidate_cols:
        if col in row and pd.notna(row[col]) and str(row[col]).strip() != "":
            parts.append(str(row[col]).strip())

    # Fallback to coordinates if no name/address fields were found
    if not parts and "lat" in row and "long" in row:
        if pd.notna(row["lat"]) and pd.notna(row["long"]):
            parts.append(f"{row['lat']}, {row['long']}")

    parts.append("data center operator")
    return " ".join(parts)


def open_google_search(query):
    """URL-encodes the query and opens it in a new browser tab."""
    encoded_query = urllib.parse.quote(query)
    url = f"https://www.google.com/search?q={encoded_query}"
    webbrowser.open_new_tab(url)


def interactive_operator_updater(input_csv_path, output_csv_path):
    print("Loading data...")
    df = pd.read_csv(input_csv_path)

    # Find rows missing the operator_name
    missing_mask = df["operator_name"].isna() | (
        df["operator_name"].astype(str).str.strip() == ""
    )
    missing_indices = df[missing_mask].index

    total_missing = len(missing_indices)
    print(f"Found {total_missing} entries missing an operator name.\n")

    if total_missing == 0:
        return

    print("--- INSTRUCTIONS ---")
    print("1. Press [ENTER] to skip to the next entry.")
    print("2. Type 's' and press [ENTER] to re-open the Google search tab.")
    print("3. Type 'q' and press [ENTER] to save and quit.")
    print("4. Type the operator name and press [ENTER] to update the CSV.\n")

    for count, idx in enumerate(missing_indices, 1):
        row = df.loc[idx]

        print("\n" + "=" * 50)
        print(f" ENTRY {count} OF {total_missing}")
        print("=" * 50)

        display_data = row.dropna()
        print(display_data.to_string())
        print("-" * 50)

        # Build and launch Google Search in your default browser
        search_query = build_search_query(row)
        print(f"[Searching]: {search_query}")
        open_google_search(search_query)

        while True:
            user_input = input(
                "\nEnter Operator Name (Enter=skip / 's'=re-search / 'q'=quit): "
            ).strip()

            if user_input.lower() == "s":
                open_google_search(search_query)
                continue
            elif user_input.lower() == "q":
                print("Progress saved. Exiting...")
                return
            elif user_input != "":
                df.at[idx, "operator_name"] = user_input
                df.to_csv(output_csv_path, index=False)
                print(f"  [+] Saved '{user_input}' to file.")
                break
            else:
                print("  [>] Skipped.")
                break


if __name__ == "__main__":
    INPUT_FILE = "updated_datacenters.csv"
    OUTPUT_FILE = "updated_datacenters.csv"

    interactive_operator_updater(INPUT_FILE, OUTPUT_FILE)