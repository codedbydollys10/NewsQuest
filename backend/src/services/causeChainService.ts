import { extractBytezText, getBytezModel, hasBytezKey } from '../lib/bytez.js';

export interface ChainNode {
  id: string;
  text: string;
  isDistractor: boolean;
}

export interface ChainEdge {
  from: string;
  to: string;
  explanation: string;
}

export interface GeneratedCauseChain {
  question: string;
  nodes: ChainNode[];
  edges: ChainEdge[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export interface CauseChainValidation {
  correctConnections: number;
  totalConnections: number;
  percentageCorrect: number;
  hasDistractor: boolean;
  feedback: string;
  allCorrect: boolean;
}

const generateNodeId = () => `node_${Math.random().toString(36).slice(2, 11)}`;

const generateCauseChainPrompt = (headline: string, summary: string, category: string): string => {
  return `You are an AI expert at creating cause-effect reasoning challenges.

Given this news article:
HEADLINE: "${headline}"
SUMMARY: "${summary}"
CATEGORY: "${category}"

Generate a cause-effect chain puzzle in JSON format. The user must arrange events in logical order.

Requirements:
1. Create a question asking users to identify the cause-effect chain
2. Generate 5-7 correct event nodes (short, 4-8 words each)
3. Add 2-3 distractor nodes that are plausible but incorrect
4. Define 4-6 correct edges (connections) between nodes
5. All nodes should be numbered node_0, node_1, etc. in the JSON

Response MUST be valid JSON with this structure:
{
  "question": "What is the sequence of events that led to [outcome]?",
  "nodes": [
    {"id": "node_0", "text": "First event happens", "isDistractor": false},
    {"id": "node_1", "text": "Unrelated but plausible event", "isDistractor": true},
    {"id": "node_2", "text": "Consequence follows", "isDistractor": false}
  ],
  "edges": [
    {"from": "node_0", "to": "node_2", "explanation": "Because first event caused consequence"},
    {"from": "node_2", "to": "node_4", "explanation": "Which led to another outcome"}
  ],
  "difficulty": "Medium"
}

Make it educational and based on the article content. Ensure the cause-effect relationships are logical and clear.`;
};

const parseCauseChainResponse = (response: string): GeneratedCauseChain | null => {
  try {
    // Remove thinking tags and extract JSON
    let cleaned = response
      .replace(/<think>[\s\S]*?<\/think>/g, '') // Remove <think>...</think> blocks
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Extract JSON object if embedded in text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }
    
    const parsed = JSON.parse(cleaned);
    
    // Validate structure
    if (!parsed.question || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      return null;
    }

    // Validate nodes
    const nodes: ChainNode[] = parsed.nodes.map((node: any) => ({
      id: node.id || generateNodeId(),
      text: String(node.text || '').slice(0, 100),
      isDistractor: Boolean(node.isDistractor),
    }));

    if (nodes.length < 5 || nodes.length > 10) {
      return null;
    }

    // Validate edges
    const edges: ChainEdge[] = parsed.edges
      .map((edge: any) => ({
        from: String(edge.from || ''),
        to: String(edge.to || ''),
        explanation: String(edge.explanation || ''),
      }))
      .filter((edge: any) => edge.from && edge.to && nodes.some(n => n.id === edge.from) && nodes.some(n => n.id === edge.to));

    if (edges.length === 0) {
      return null;
    }

    return {
      question: String(parsed.question || '').slice(0, 200),
      nodes,
      edges,
      difficulty: ['Easy', 'Medium', 'Hard'].includes(parsed.difficulty) ? parsed.difficulty : 'Medium',
    };
  } catch {
    return null;
  }
};

const generateMockCauseChain = (headline: string, summary: string): GeneratedCauseChain => {
  const nodes: ChainNode[] = [
    { id: 'node_0', text: 'Initial Event Occurs', isDistractor: false },
    { id: 'node_1', text: 'Direct Consequence Follows', isDistractor: false },
    { id: 'node_2', text: 'Secondary Effect Emerges', isDistractor: false },
    { id: 'node_3', text: 'Unrelated Development', isDistractor: true },
    { id: 'node_4', text: 'Final Outcome Manifests', isDistractor: false },
    { id: 'node_5', text: 'Long-term Impact Realized', isDistractor: false },
  ];

  const edges: ChainEdge[] = [
    { from: 'node_0', to: 'node_1', explanation: 'Direct consequence of initial event' },
    { from: 'node_1', to: 'node_2', explanation: 'Secondary effects follow' },
    { from: 'node_2', to: 'node_4', explanation: 'Leads to overall outcome' },
    { from: 'node_4', to: 'node_5', explanation: 'Results in long-term impact' },
  ];

  return {
    question: `What is the sequence of events and their effects in: "${headline.slice(0, 60)}"?`,
    nodes,
    edges,
    difficulty: 'Medium',
  };
};

export const generateCauseChain = async (
  headline: string,
  summary: string,
  category: string,
): Promise<GeneratedCauseChain | null> => {
  if (!hasBytezKey()) {
    // Return mock cause chain for development/new accounts without API key
    return generateMockCauseChain(headline, summary);
  }

  try {
    const prompt = generateCauseChainPrompt(headline, summary, category);
    const model = getBytezModel();
    const { error, output } = await model.run([
      {
        role: 'system',
        content: 'You are an AI expert at creating cause-effect reasoning challenges. Always respond with valid JSON only.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ]);

    if (error) {
      return null;
    }

    if (!output) {
      return null;
    }

    const text = extractBytezText(output);
    if (!text) {
      return null;
    }

    const parsed = parseCauseChainResponse(text);
    if (!parsed) {
      return null;
    }

    return parsed;
  } catch (error) {
    return null;
  }
};

export const generateFeedbackPrompt = (
  question: string,
  nodes: ChainNode[],
  edges: ChainEdge[],
  userChain: string[],
  userConnections: Array<{ from: string; to: string }>,
): string => {
  const correctChain = edges
    .map(e => `${nodes.find(n => n.id === e.from)?.text} → ${nodes.find(n => n.id === e.to)?.text}`)
    .join(' → ');

  return `What is the correct cause-effect chain for this news event? 

Just return the chain in this exact format:
${correctChain}`;
};

export const generateCauseChainFeedback = async (
  question: string,
  nodes: ChainNode[],
  edges: ChainEdge[],
  userChain: string[],
  userConnections: Array<{ from: string; to: string }>,
): Promise<string> => {
  // Build correct chain string - just show the answer
  const correctChain = edges
    .map(e => `${nodes.find(n => n.id === e.from)?.text} → ${nodes.find(n => n.id === e.to)?.text}`)
    .join(' → ');

  // Don't use AI - just return the correct answer
  return `Correct answer: ${correctChain}`;
};

export const validateCauseChain = (
  userConnections: Array<{ from: string; to: string }>,
  correctEdges: ChainEdge[],
  userChain: string[],
  nodes: ChainNode[],
): CauseChainValidation => {
  let correctConnections = 0;
  let hasDistractor = false;

  // Check if user included any distractor nodes in their chain
  for (const nodeId of userChain) {
    const node = nodes.find(n => n.id === nodeId);
    if (node?.isDistractor) {
      hasDistractor = true;
      console.log('[Validation] Found distractor node:', node.text);
    }
  }

  // Validate each user connection
  for (const userConn of userConnections) {
    const isCorrect = correctEdges.some(
      edge => edge.from === userConn.from && edge.to === userConn.to,
    );
    if (isCorrect) {
      correctConnections++;
    }
  }

  const totalConnections = userConnections.length;
  const percentageCorrect = totalConnections > 0 ? Math.round((correctConnections / totalConnections) * 100) : 0;

  let allCorrect = false;
  if (correctConnections === correctEdges.length && !hasDistractor && totalConnections === correctEdges.length) {
    allCorrect = true;
  }

  console.log('[Validation] Results:', {
    correctConnections,
    totalConnections,
    correctEdgesRequired: correctEdges.length,
    percentageCorrect,
    hasDistractor,
    allCorrect,
  });

  let feedback = '';
  if (allCorrect) {
    feedback = 'Perfect! You nailed the cause-effect chain!';
  } else if (percentageCorrect >= 75) {
    feedback = 'Great work! Most of your connections are correct. Review the remaining links.';
  } else if (percentageCorrect >= 50) {
    feedback = 'Good effort! About half of your connections are right. Think about the cause-effect flow more carefully.';
  } else if (hasDistractor) {
    feedback = '⚠️ You included an unrelated event. Focus on events directly connected to the news story.';
  } else {
    feedback = 'Need to rethink the sequence. Study how each event causes the next one.';
  }

  return {
    correctConnections,
    totalConnections,
    percentageCorrect,
    hasDistractor,
    feedback,
    allCorrect,
  };
};

export const calculateXPReward = (validation: CauseChainValidation): { xpEarned: number; xpPenalty: number } => {
  let xpEarned = 0;
  let xpPenalty = 0;

  if (validation.allCorrect) {
    xpEarned = 40; // Perfect score
    console.log('[XPReward] Perfect score: +40 XP');
  } else {
    // Base XP for attempt
    xpEarned = Math.max(10, Math.round((validation.percentageCorrect / 100) * 40));
    console.log('[XPReward] Partial score:', validation.percentageCorrect + '% = +' + xpEarned + ' XP');
  }

  // Apply penalties
  if (validation.hasDistractor) {
    xpPenalty = 15;
    console.log('[XPReward] Distractor included: -15 XP penalty');
  } else if (validation.totalConnections === 0) {
    xpEarned = 0;
    xpPenalty = 10;
    console.log('[XPReward] No connections: 0 XP earned, -10 penalty');
  }

  // If total mistakes exceed threshold, apply large penalty
  const mistakes = validation.totalConnections - validation.correctConnections;
  if (mistakes > validation.totalConnections * 0.5) {
    // More than 50% wrong
    xpPenalty = Math.max(xpPenalty, 30);
    console.log('[XPReward] More than 50% wrong: maximum penalty -30');
  }

  const finalXP = Math.max(0, xpEarned - xpPenalty);
  console.log('[XPReward] Final: ' + xpEarned + ' - ' + xpPenalty + ' = ' + finalXP + ' XP');

  return {
    xpEarned: finalXP,
    xpPenalty,
  };
};
