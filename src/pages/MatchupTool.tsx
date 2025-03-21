import React, { useState, useEffect } from 'react';
import { useGolfStore } from '../store/useGolfStore';
import { Golfer } from '../types/golf';
import { datagolfService } from '../services/api/datagolfService';

interface Matchup {
  p1_player_name: string;
  p2_player_name: string;
  odds: {
    [bookmaker: string]: {
      p1: string;
      p2: string;
      tie?: string;
    };
  };
  ties: "void" | "separate bet offered";
}

interface MatchupResponse {
  event_name: string;
  last_updated: string;
  market: string;
  match_list: Matchup[] | string;
}

function MatchupTool() {
  const { golfers, runSimulation, fetchGolferData } = useGolfStore();
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [selectedMatchup, setSelectedMatchup] = useState<Matchup | null>(null);
  const [odds, setOdds] = useState<string>('');
  const [betAmount, setBetAmount] = useState<string>('100');
  const [isYourPickP1, setIsYourPickP1] = useState<boolean>(true);
  const [selectedGolfer1, setSelectedGolfer1] = useState<Golfer | null>(null);
  const [selectedGolfer2, setSelectedGolfer2] = useState<Golfer | null>(null);
  const [error, setError] = useState<string>('');
  const [eventName, setEventName] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [selectedBookmaker, setSelectedBookmaker] = useState<string>('');

  useEffect(() => {
    const init = async () => {
      try {
        await fetchGolferData();  // First get all golfer data including odds
        runSimulation();  // Run simulation once on initial load
      } catch (error) {
        console.error('Error fetching golfer data:', error);
        setError('Failed to fetch golfer data. Please try again later.');
      }
    };
    init();
  }, [fetchGolferData, runSimulation]);

  useEffect(() => {
    const fetchMatchups = async () => {
      if (golfers.length === 0) return; // Wait for golfers to be loaded

      try {
        const response = await datagolfService.getMatchups() as MatchupResponse;

        setEventName(response.event_name);
        setLastUpdated(response.last_updated);

        if (typeof response.match_list === 'string') {
          setError(response.match_list);
          setMatchups([]);
        } else {
          setMatchups(response.match_list || []);
          setError('');
        }
      } catch (error) {
        console.error('Error fetching matchups:', error);
        setError('Failed to fetch matchups. Please try again later.');
        setMatchups([]);
      }
    };
    fetchMatchups();
  }, [golfers.length]); // Only run when golfers are loaded

  useEffect(() => {
    if (selectedGolfer1 && selectedGolfer2) {
      // Keep this empty - no automatic simulation on golfer selection
    }
  }, [selectedGolfer1, selectedGolfer2]);

  useEffect(() => {
    if (selectedMatchup && selectedBookmaker && selectedMatchup.odds[selectedBookmaker]) {
      // Update odds based on which player is selected
      setOdds(isYourPickP1 
        ? selectedMatchup.odds[selectedBookmaker].p1 
        : selectedMatchup.odds[selectedBookmaker].p2
      );
    }
  }, [isYourPickP1, selectedBookmaker, selectedMatchup]);

  const getFilteredMatchups = () => {
    console.log('Total matchups before filtering:', matchups.length);
    console.log('Total golfers in data:', golfers.length);

    const missingGolfers = new Set<string>();
    
    const filtered = matchups.filter(matchup => {
      const p1InGolfers = golfers.some(g => g.name.toLowerCase() === matchup.p1_player_name.toLowerCase());
      const p2InGolfers = golfers.some(g => g.name.toLowerCase() === matchup.p2_player_name.toLowerCase());
      
      if (!p1InGolfers) {
        missingGolfers.add(matchup.p1_player_name);
      }
      if (!p2InGolfers) {
        missingGolfers.add(matchup.p2_player_name);
      }

      return p1InGolfers && p2InGolfers;
    });

    console.log('Matchups after filtering:', filtered.length);
    console.log('Players missing from golfer data:', Array.from(missingGolfers).sort());

    // Log some sample golfer names to help debug potential name mismatches
    console.log('Sample golfer names in our data:', golfers.slice(0, 5).map(g => g.name));
    
    return filtered;
  };

  const filteredMatchups = getFilteredMatchups();

  const getMatchupKey = (matchup: Matchup) => {
    return `${matchup.p1_player_name}-${matchup.p2_player_name}-${matchup.ties}`;
  };

  const getMatchupDisplayText = (matchup: Matchup) => {
    const tieText = matchup.ties === "void" ? "(Tie: Void)" : "(Tie: Offered)";
    return `${matchup.p1_player_name} vs ${matchup.p2_player_name} ${tieText}`;
  };

  const getAvailableBookmakers = (matchup: Matchup | null): string[] => {
    if (!matchup) return [];
    
    // Get all bookmakers except datagolf
    const bookmakers = Object.keys(matchup.odds).filter(book => book !== 'datagolf');
    return bookmakers;
  };

  const handlePlayerSelect = (value: string) => {
    // value format: "p1Name|p2Name|tieTerms"
    const [p1Name, p2Name, tieTerm] = value.split('|');
    
    const matchup = filteredMatchups.find(m => 
      m.p1_player_name === p1Name && 
      m.p2_player_name === p2Name && 
      m.ties === tieTerm
    );

    if (matchup) {
      setSelectedMatchup(matchup);
      setIsYourPickP1(true);

      // Get available bookmakers and select the first one
      const bookmakers = getAvailableBookmakers(matchup);
      const firstBook = bookmakers[0] || '';
      setSelectedBookmaker(firstBook);

      // Set odds based on selected bookmaker
      if (firstBook && matchup.odds[firstBook]) {
        setOdds(matchup.odds[firstBook].p1);
      }

      // Find golfers in our simulation data
      const golfer1 = golfers.find(g => g.name.toLowerCase() === p1Name.toLowerCase());
      const golfer2 = golfers.find(g => g.name.toLowerCase() === p2Name.toLowerCase());

      setSelectedGolfer1(golfer1 || null);
      setSelectedGolfer2(golfer2 || null);
    }
  };

  useEffect(() => {
    if (selectedMatchup && golfers.length > 0) {
      const golfer1Name = isYourPickP1 ? selectedMatchup.p1_player_name : selectedMatchup.p2_player_name;
      const golfer2Name = isYourPickP1 ? selectedMatchup.p2_player_name : selectedMatchup.p1_player_name;
      
      const golfer1 = golfers.find(g => g.name.toLowerCase() === golfer1Name.toLowerCase());
      const golfer2 = golfers.find(g => g.name.toLowerCase() === golfer2Name.toLowerCase());

      setSelectedGolfer1(golfer1 || null);
      setSelectedGolfer2(golfer2 || null);
    }
  }, [golfers, selectedMatchup, isYourPickP1]);

  const calculateEdge = () => {
    if (!selectedMatchup || !selectedBookmaker) return null;

    // Get DataGolf's odds for the selected player
    const dgOdds = selectedMatchup.odds.datagolf;
    if (!dgOdds) return null;

    // Get selected bookmaker's odds
    const bookOdds = selectedMatchup.odds[selectedBookmaker];
    if (!bookOdds) return null;

    // Get the right odds based on which player was picked
    const dgOddsStr = isYourPickP1 ? dgOdds.p1 : dgOdds.p2;
    const bookOddsStr = isYourPickP1 ? bookOdds.p1 : bookOdds.p2;

    // Convert DataGolf's American odds to implied probability
    const dgOddsNum = parseInt(dgOddsStr);
    const dgImpliedProb = dgOddsNum > 0
      ? (100 / (dgOddsNum + 100))
      : (Math.abs(dgOddsNum) / (Math.abs(dgOddsNum) + 100));

    // Convert bookmaker's American odds to implied probability
    const bookOddsNum = parseInt(bookOddsStr);
    const bookImpliedProb = bookOddsNum > 0
      ? (100 / (bookOddsNum + 100))
      : (Math.abs(bookOddsNum) / (Math.abs(bookOddsNum) + 100));

    // Calculate edge: datagolf implied prob - bookmaker implied prob
    // Multiply by 100 to convert to percentage
    const edge = (dgImpliedProb - bookImpliedProb) * 100;
    
    // For debugging
    console.log('DataGolf odds:', dgOddsNum, 'implied prob:', dgImpliedProb * 100);
    console.log('Bookmaker odds:', bookOddsNum, 'implied prob:', bookImpliedProb * 100);
    console.log('Edge:', edge);

    return edge;
  };

  const calculatePayout = () => {
    if (!odds || !betAmount) return null;

    const amount = parseFloat(betAmount);
    const oddsNum = parseInt(odds);

    if (oddsNum > 0) {
      return (amount * (oddsNum / 100)).toFixed(2);
    } else {
      return (amount * (100 / Math.abs(oddsNum))).toFixed(2);
    }
  };

  const edge = calculateEdge();
  const payout = calculatePayout();

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-6">Matchup Analysis Tool</h2>
      
      {/* <button
        onClick={runSimulation}
        className="bg-sharpside-green text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
      >
        Run Simulation
      </button> */}

      <div className="mb-6">
        <div className="text-sm text-gray-600">
          Event: {eventName}
        </div>
        <div className="text-sm text-gray-600">
          Last Updated: {lastUpdated}
        </div>
      </div>

      {error && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">No {error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Select Matchup
            </label>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              First Player Selected to Win
            </span>
          </div>
          <select
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            value={selectedMatchup ? `${selectedMatchup.p1_player_name}|${selectedMatchup.p2_player_name}|${selectedMatchup.ties}` : ''}
            onChange={(e) => handlePlayerSelect(e.target.value)}
          >
            <option value="">Select Matchup</option>
            {filteredMatchups.map((matchup) => (
              <option 
                key={getMatchupKey(matchup)} 
                value={`${matchup.p1_player_name}|${matchup.p2_player_name}|${matchup.ties}`}
              >
                {getMatchupDisplayText(matchup)}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Your Pick
            </label>
            <div className="flex space-x-2">
              <button
                onClick={() => setIsYourPickP1(true)}
                className={`px-3 py-1 text-xs rounded-full ${isYourPickP1 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-200 text-gray-700'}`}
              >
                {selectedMatchup?.p1_player_name || 'Player 1'}
              </button>
              <button
                onClick={() => setIsYourPickP1(false)}
                className={`px-3 py-1 text-xs rounded-full ${!isYourPickP1 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-200 text-gray-700'}`}
              >
                {selectedMatchup?.p2_player_name || 'Player 2'}
              </button>
            </div>
          </div>
          <div className="text-center p-2 bg-gray-100 rounded-md">
            {selectedMatchup ? (
              <span className="font-medium">
                {isYourPickP1 ? selectedMatchup.p1_player_name : selectedMatchup.p2_player_name}
              </span>
            ) : (
              <span className="text-gray-500">Select a matchup first</span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Odds for Your Pick (e.g., +120 or -110)
          </label>
          <input
            type="text"
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            value={odds}
            readOnly
          />
          {selectedMatchup && (
            <div className="mt-1 text-sm text-gray-500">
              Ties: {selectedMatchup.ties === "void" ? (
                <span className="text-orange-600">Void (push if tied)</span>
              ) : (
                <span className="text-purple-600">
                  Separate bet available
                  {selectedMatchup.odds.bet365?.tie && ` (${selectedMatchup.odds.bet365.tie})`}
                </span>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bet Amount ($)
          </label>
          <input
            type="number"
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
          />
        </div>
      </div>

      {selectedMatchup && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Select Bookmaker</label>
          <select
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            value={selectedBookmaker}
            onChange={(e) => {
              setSelectedBookmaker(e.target.value);
              // Update odds when bookmaker changes
              if (selectedMatchup.odds[e.target.value]) {
                setOdds(isYourPickP1 
                  ? selectedMatchup.odds[e.target.value].p1 
                  : selectedMatchup.odds[e.target.value].p2
                );
              }
            }}
          >
            <option value="">Select a bookmaker</option>
            {getAvailableBookmakers(selectedMatchup).map(book => (
              <option key={book} value={book}>{book}</option>
            ))}
          </select>
        </div>
      )}

      {selectedGolfer1 && selectedGolfer2 && odds && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Projected Win Probability</h3>
            <p className="text-2xl font-bold text-gray-900">
              {((selectedGolfer1.simulationStats.winPercentage /
                (selectedGolfer1.simulationStats.winPercentage + selectedGolfer2.simulationStats.winPercentage)) * 100).toFixed(1)}%
            </p>
            <p className="text-sm text-gray-500 mt-1">
              For {selectedGolfer1.name}
            </p>
          </div> */}

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Model Edge</h3>
            <p className={`text-2xl font-bold ${edge && edge > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {edge ? `${edge.toFixed(1)}%` : '-'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {edge && edge > 0 ? 'Favorable Edge' : 'Unfavorable Edge'}
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Potential Payout</h3>
            <p className="text-2xl font-bold text-gray-900">
              ${payout || '-'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              If {selectedGolfer1?.name} wins
            </p>
          </div>
        </div>
      )}
      {selectedGolfer1 && selectedGolfer2 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Head-to-Head Comparison</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Metric
                  </th>
                  <th className="px-6 py-3 bg-green-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {selectedGolfer1.name} (Your Pick)
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {selectedGolfer2.name}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    SG: Total
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 bg-green-50">
                    {selectedGolfer1.strokesGainedTotal.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                    {selectedGolfer2.strokesGainedTotal.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Top 10 %
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 bg-green-50">
                    {selectedGolfer1.simulationStats.top10Percentage.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                    {selectedGolfer2.simulationStats.top10Percentage.toFixed(1)}%
                  </td>
                </tr>
                {/* <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Win Probability
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 bg-green-50">
                    {selectedGolfer1.simulationStats.winPercentage.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                    {selectedGolfer2.simulationStats.winPercentage.toFixed(1)}%
                  </td>
                </tr> */}

                {/* <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Average Finish
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 bg-green-50">
                    {selectedGolfer1.simulationStats.averageFinish.toFixed(1)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                    {selectedGolfer2.simulationStats.averageFinish.toFixed(1)}
                  </td>
                </tr> */}

              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default MatchupTool;